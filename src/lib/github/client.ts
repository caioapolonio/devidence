import { Octokit } from "octokit";

import {
  normalizeRepository,
  sortByRecentActivity,
  type RawRepository,
  type Repository,
} from "@/lib/github/repos";

/**
 * Cliente do GitHub para um usuário.
 *
 * O token entra por parâmetro e não é guardado em nada de escopo global: cada
 * request cria o seu, com o token da sessão de quem fez o request. Um cliente
 * compartilhado entre requests seria a forma mais fácil de vazar dados de um
 * usuário para outro.
 */
export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    userAgent: "devidence",
    throttle: {
      // O throttling do octokit já espera o tempo indicado pelo GitHub; estes
      // handlers só decidem se vale a pena tentar de novo. Sem eles o octokit
      // emite aviso e desiste na primeira vez.
      onRateLimit: (
        _retryAfter: number,
        _options: unknown,
        _octokit: unknown,
        retryCount: number,
      ) => retryCount < 2,
      onSecondaryRateLimit: (
        _retryAfter: number,
        _options: unknown,
        _octokit: unknown,
        retryCount: number,
      ) => retryCount < 2,
    },
  });
}

/**
 * Repositórios em que o usuário tem acesso de escrita ou é dono.
 *
 * `affiliation` exclui repositórios em que a pessoa só tem acesso de leitura:
 * relatar contribuição própria em projeto que você só consegue ler é caso raro
 * o bastante para não valer poluir a lista.
 */
export async function listRepositories(
  client: Octokit,
): Promise<Repository[]> {
  const raw = (await client.paginate(
    client.rest.repos.listForAuthenticatedUser,
    {
      affiliation: "owner,collaborator,organization_member",
      sort: "pushed",
      direction: "desc",
      per_page: 100,
    },
  )) as unknown as RawRepository[];

  return sortByRecentActivity(raw.map(normalizeRepository));
}
