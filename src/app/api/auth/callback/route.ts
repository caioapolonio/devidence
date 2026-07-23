import { NextResponse, type NextRequest } from "next/server";

import {
  buildRedirectUri,
  exchangeCodeForToken,
  fetchGitHubUser,
  isValidState,
  mapGitHubError,
  STATE_COOKIE,
  type AuthFailure,
} from "@/lib/auth/github-oauth";
import { serverEnv } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

function failure(request: NextRequest, reason: AuthFailure) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/**
 * GitHub's return.
 *
 * Order matters: the `state` is checked before any network call. Exchanging the
 * code first and validating afterwards would turn a forged request into a real
 * token exchange.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const githubError = mapGitHubError(params.get("error"));
  if (githubError) return failure(request, githubError);

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!isValidState(params.get("state"), expectedState)) {
    return failure(request, "invalid_state");
  }

  const code = params.get("code");
  if (!code) return failure(request, "exchange_failed");

  const accessToken = await exchangeCodeForToken({
    clientId: serverEnv.githubClientId,
    clientSecret: serverEnv.githubClientSecret,
    code,
    redirectUri: buildRedirectUri(serverEnv.appUrl),
  });
  if (!accessToken) return failure(request, "exchange_failed");

  const user = await fetchGitHubUser(accessToken);
  if (!user) return failure(request, "user_unavailable");

  const session = await getSession();
  session.user = { ...user, accessToken };
  await session.save();

  const response = NextResponse.redirect(new URL("/", request.url));
  // The state has done its job; leaving it in the browser only widens the replay
  // window.
  response.cookies.delete(STATE_COOKIE);
  return response;
}
