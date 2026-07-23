import { Octokit } from "octokit";

import {
  normalizeRepository,
  sortByRecentActivity,
  type RawRepository,
  type Repository,
} from "@/lib/github/repos";

/**
 * A GitHub client for one user.
 *
 * The token comes in as a parameter and is never stored in anything of global
 * scope: each request builds its own, with the token from that request's
 * session. A client shared across requests would be the easiest way to leak one
 * user's data to another.
 */
export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    userAgent: "devidence",
    throttle: {
      // Octokit's throttling already waits the time GitHub asks for; these
      // handlers only decide whether it's worth trying again. Without them
      // octokit warns and gives up on the first hit.
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
 * Repositories where the user has write access or is the owner.
 *
 * `affiliation` excludes repositories where the person only has read access:
 * reporting on your own contribution to a project you can merely read is rare
 * enough not to clutter the list.
 */
export async function listRepositories(client: Octokit): Promise<Repository[]> {
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
