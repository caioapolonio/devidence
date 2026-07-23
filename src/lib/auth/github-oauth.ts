import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Pure pieces of the GitHub OAuth flow.
 *
 * Kept apart from the routes so they can be tested without the network, in
 * particular the `state` validation, which is the CSRF protection and the spot
 * where hand-written OAuth tends to fail silently.
 */

export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_API_USER_URL = "https://api.github.com/user";

/**
 * `read:user` identifies who is logged in; `repo` is needed because the real use
 * case is a report about work in a client's private repository. There is no
 * middle-ground scope in GitHub's classic OAuth: it's either `public_repo` or
 * full repository access.
 */
export const GITHUB_SCOPES = ["read:user", "repo"] as const;

export const STATE_COOKIE = "devidence_oauth_state";
/** Ten minutes: plenty for the user to decide, short for replay. */
export const STATE_MAX_AGE_SECONDS = 600;

export function createState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Constant-time comparison. A `===` here would leak, through response time, how
 * many leading characters the attacker got right.
 */
export function isValidState(
  received: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (!received || !expected) return false;

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual requires equal lengths; comparing length first leaks nothing
  // beyond what the state format already reveals.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function buildRedirectUri(appUrl: string): string {
  return new URL("/api/auth/callback", appUrl).toString();
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", GITHUB_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
};

/** Failure reasons the login screen knows how to explain. */
export type AuthFailure =
  | "access_denied"
  | "invalid_state"
  | "exchange_failed"
  | "user_unavailable";

/**
 * Translates the `error` parameter GitHub returns when the user declines
 * authorization. Any other value falls into `exchange_failed`: modeling every
 * GitHub code isn't worth it, but swallowing the error would be worse.
 */
export function mapGitHubError(error: string | null): AuthFailure | null {
  if (!error) return null;
  if (error === "access_denied") return "access_denied";
  return "exchange_failed";
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const doFetch = params.fetchImpl ?? fetch;

  const response = await doFetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      // Without this GitHub replies form-encoded instead of JSON.
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
  };

  return payload.access_token ?? null;
}

export async function fetchGitHubUser(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubUser | null> {
  const response = await fetchImpl(GITHUB_API_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };

  return {
    id: payload.id,
    login: payload.login,
    name: payload.name,
    avatarUrl: payload.avatar_url,
  };
}
