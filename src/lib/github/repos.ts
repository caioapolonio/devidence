/**
 * Repositórios que o usuário pode escolher.
 *
 * A normalização e a ordenação ficam separadas da chamada de rede para poderem
 * ser testadas sem GitHub. O que a API devolve é grande e cheio de campos que
 * não usamos; guardar só o necessário evita carregar dado de repositório
 * privado por engano para o cliente.
 */

export type Repository = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  defaultBranch: string;
  htmlUrl: string;
  /** ISO 8601. Null quando o repositório nunca recebeu push. */
  pushedAt: string | null;
  description: string | null;
};

/** Recorte dos campos da API que realmente usamos. */
export type RawRepository = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string } | null;
  private: boolean;
  archived: boolean;
  fork: boolean;
  default_branch: string;
  html_url: string;
  pushed_at: string | null;
  description: string | null;
};

export function normalizeRepository(raw: RawRepository): Repository {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    // O `owner` pode vir nulo em respostas de repositório apagado.
    owner: raw.owner?.login ?? raw.full_name.split("/")[0] ?? "",
    isPrivate: raw.private,
    isArchived: raw.archived,
    isFork: raw.fork,
    defaultBranch: raw.default_branch,
    htmlUrl: raw.html_url,
    pushedAt: raw.pushed_at,
    description: raw.description,
  };
}

/**
 * Mais recentes primeiro. Repositório sem push nenhum vai para o fim em vez de
 * ser descartado — pode ser um projeto novo que a pessoa quer relatar.
 */
export function sortByRecentActivity(repositories: Repository[]): Repository[] {
  return [...repositories].sort((a, b) => {
    if (a.pushedAt === b.pushedAt) return a.fullName.localeCompare(b.fullName);
    if (!a.pushedAt) return 1;
    if (!b.pushedAt) return -1;
    return b.pushedAt.localeCompare(a.pushedAt);
  });
}

/**
 * Busca por nome ou descrição, sem diferenciar maiúsculas nem acentos — o
 * usuário digitando "sao" precisa achar "São Paulo".
 */
export function filterRepositories(
  repositories: Repository[],
  query: string,
): Repository[] {
  const needle = fold(query.trim());
  if (!needle) return repositories;

  return repositories.filter(
    (repository) =>
      fold(repository.fullName).includes(needle) ||
      fold(repository.description ?? "").includes(needle),
  );
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
