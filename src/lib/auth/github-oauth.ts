import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Peças puras do fluxo OAuth do GitHub.
 *
 * Ficam separadas das rotas para poderem ser testadas sem rede — em especial a
 * validação do `state`, que é a proteção contra CSRF e o ponto onde OAuth
 * escrito à mão costuma falhar em silêncio.
 */

export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_API_USER_URL = "https://api.github.com/user";

/**
 * `read:user` identifica quem está logado; `repo` é necessário porque o caso de
 * uso real do produto é relatório sobre trabalho em repositório privado de
 * cliente. Não existe escopo intermediário no OAuth clássico do GitHub: ou é
 * `public_repo`, ou é acesso completo de repositório.
 */
export const GITHUB_SCOPES = ["read:user", "repo"] as const;

export const STATE_COOKIE = "devidence_oauth_state";
/** Dez minutos: tempo de sobra para o usuário decidir, curto para replay. */
export const STATE_MAX_AGE_SECONDS = 600;

export function createState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Comparação em tempo constante. Um `===` aqui vaza, pelo tempo de resposta,
 * quantos caracteres iniciais o atacante acertou.
 */
export function isValidState(
  received: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (!received || !expected) return false;

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual exige tamanhos iguais; comparar o tamanho antes não vaza
  // nada além do que o próprio formato do state já revela.
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

/** Motivos de falha que a tela de login sabe explicar em português. */
export type AuthFailure =
  | "acesso_negado"
  | "estado_invalido"
  | "troca_falhou"
  | "usuario_indisponivel";

/**
 * Traduz o parâmetro `error` que o GitHub devolve quando o usuário recusa a
 * autorização. Qualquer outro valor cai em `troca_falhou` — não vale a pena
 * modelar cada código do GitHub, mas engolir o erro seria pior.
 */
export function mapGitHubError(error: string | null): AuthFailure | null {
  if (!error) return null;
  if (error === "access_denied") return "acesso_negado";
  return "troca_falhou";
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
      // Sem isto o GitHub responde form-encoded em vez de JSON.
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
