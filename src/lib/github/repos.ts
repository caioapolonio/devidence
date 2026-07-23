/**
 * Repositories the user can pick from.
 *
 * Normalization and sorting are kept apart from the network call so they can be
 * tested without GitHub. What the API returns is large and full of fields we
 * don't use; keeping only what's needed avoids carrying private-repo detail to
 * the client by accident.
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
  /** ISO 8601. Null when the repository has never been pushed to. */
  pushedAt: string | null;
  description: string | null;
};

/** The subset of API fields we actually use. */
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
    // `owner` can come back null in responses for a deleted repository.
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
 * Most recent first. A repository with no pushes at all goes to the end rather
 * than being dropped: it may be a new project the person wants to report on.
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
 * Search by name or description, ignoring case and accents. Someone typing
 * "sao" needs to find "São Paulo".
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
