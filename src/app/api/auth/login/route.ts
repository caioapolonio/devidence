import { NextResponse } from "next/server";

import {
  buildAuthorizeUrl,
  buildRedirectUri,
  createState,
  STATE_COOKIE,
  STATE_MAX_AGE_SECONDS,
} from "@/lib/auth/github-oauth";
import { isProduction, serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Start of the OAuth flow.
 *
 * The `state` is generated here, kept in an httpOnly cookie, and re-checked in
 * the callback. It's what stops someone from forging an authorization return and
 * attaching their GitHub account to another person's session.
 */
export async function GET() {
  const state = createState();

  const authorizeUrl = buildAuthorizeUrl({
    clientId: serverEnv.githubClientId,
    redirectUri: buildRedirectUri(serverEnv.appUrl),
    state,
  });

  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  return response;
}
