import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import { isProduction, serverEnv } from "@/lib/env";

/**
 * Sessão do usuário.
 *
 * O token do GitHub vive **apenas** aqui: dentro do cookie cifrado, no browser
 * de quem logou. Não existe tabela de tokens, custódia nem rotação, porque o
 * produto não faz sincronização agendada — tudo acontece dentro de um request
 * iniciado pela pessoa dona do token.
 *
 * A consequência é deliberada: sem sessão ativa, o servidor não consegue tocar
 * em nenhum repositório de ninguém.
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
};

/**
 * Função, não constante: ler o segredo no topo do módulo faria o `next build`
 * quebrar em qualquer ambiente sem `.env`, inclusive no CI, que não precisa de
 * segredo nenhum para compilar.
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
      // Sete dias. Depois disso é relogin — o token do GitHub não é renovado
      // porque não há refresh token no OAuth clássico.
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

/** Usuário logado, ou `null`. Nunca lança. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}
