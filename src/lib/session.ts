import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import { isProduction, serverEnv } from "@/lib/env";
import type { LlmCredentials } from "@/lib/llm/types";

/**
 * User session.
 *
 * The GitHub token lives here and nowhere else: inside the encrypted cookie, in
 * the browser of whoever logged in. There is no token table, no custody, no
 * rotation, because the product does no scheduled syncing. Everything happens
 * within a request started by the very person who owns the token.
 *
 * The consequence is deliberate: with no active session, the server cannot
 * touch anyone's repositories.
 */
export type SessionUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  accessToken: string;
};

export type SessionData = {
  user?: SessionUser;
  /**
   * The user's own LLM key. Same treatment as the GitHub token: encrypted in
   * the cookie, never in a database, gone on sign-out.
   */
  llm?: LlmCredentials;
};

/**
 * A function, not a constant: reading the secret at module load would make
 * `next build` fail in any environment without a `.env`, including CI, which
 * needs no secret to compile.
 */
export function getSessionOptions(): SessionOptions {
  return {
    password: serverEnv.sessionSecret,
    cookieName: "devidence_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      // Seven days. After that it's a re-login: the GitHub token is not
      // refreshed because classic OAuth has no refresh token.
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

/** Logged-in user, or `null`. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}

/** The session's LLM credentials, or `null`. */
export async function getLlmCredentials(): Promise<LlmCredentials | null> {
  const session = await getSession();
  return session.llm ?? null;
}
