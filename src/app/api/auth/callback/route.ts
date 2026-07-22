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
  url.searchParams.set("erro", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/**
 * Retorno do GitHub.
 *
 * A ordem importa: o `state` é conferido **antes** de qualquer chamada de rede.
 * Trocar o code primeiro e validar depois transformaria um pedido forjado numa
 * troca real de token.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const githubError = mapGitHubError(params.get("error"));
  if (githubError) return failure(request, githubError);

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!isValidState(params.get("state"), expectedState)) {
    return failure(request, "estado_invalido");
  }

  const code = params.get("code");
  if (!code) return failure(request, "troca_falhou");

  const accessToken = await exchangeCodeForToken({
    clientId: serverEnv.githubClientId,
    clientSecret: serverEnv.githubClientSecret,
    code,
    redirectUri: buildRedirectUri(serverEnv.appUrl),
  });
  if (!accessToken) return failure(request, "troca_falhou");

  const user = await fetchGitHubUser(accessToken);
  if (!user) return failure(request, "usuario_indisponivel");

  const session = await getSession();
  session.user = { ...user, accessToken };
  await session.save();

  const response = NextResponse.redirect(new URL("/", request.url));
  // O state cumpriu a função; deixá-lo no browser só aumenta a janela de replay.
  response.cookies.delete(STATE_COOKIE);
  return response;
}
