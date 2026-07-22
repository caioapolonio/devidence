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
 * Início do fluxo OAuth.
 *
 * O `state` é gerado aqui, guardado num cookie httpOnly e reconferido no
 * callback. É o que impede alguém de forjar um retorno de autorização e
 * conectar a conta do GitHub dele à sessão de outra pessoa.
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
