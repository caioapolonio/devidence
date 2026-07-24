import type { Octokit } from "octokit";

import {
  resolveAttribution,
  type Attribution,
  type Identity,
} from "@/lib/github/attribution";
import type { Period } from "@/lib/period";

/**
 * The repository's activity in a window, from the point of view of one person.
 *
 * This is the layer the report generator reads. It keeps two macOS-app
 * principles that the tese of the product depends on:
 *
 *   - **PR-first grouping.** A commit is tied to a pull request only because the
 *     PR's own commits endpoint returned it, never by parsing the commit
 *     message or guessing from branch names. `directCommits` are the ones no
 *     fetched PR claimed.
 *   - **Honest coverage.** When a commit's author can't be resolved to a GitHub
 *     account and its email is unknown, it is neither confirmed nor denied as
 *     personal. Those are counted, and `coverage` says so, rather than being
 *     silently dropped or silently attributed.
 */

// --- Normalized types ---------------------------------------------------------

export type Commit = {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorEmail: string | null;
  authoredAt: string | null;
  committedAt: string | null;
  htmlUrl: string;
  attribution: Attribution;
};

export type Review = {
  id: number;
  authorLogin: string | null;
  state: string;
  body: string;
  submittedAt: string | null;
  htmlUrl: string;
  isPersonal: boolean;
};

/** How the person is connected to a pull request. */
export type PersonalRole = "author" | "reviewer" | "commit";

export type PullRequest = {
  number: number;
  title: string;
  body: string;
  state: string;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  headRef: string;
  htmlUrl: string;
  commits: Commit[];
  reviews: Review[];
  personalRoles: PersonalRole[];
  isPersonal: boolean;
};

export type Issue = {
  number: number;
  title: string;
  body: string;
  state: string;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  htmlUrl: string;
  isPersonal: boolean;
};

export type Release = {
  tagName: string;
  name: string;
  body: string;
  isPrerelease: boolean;
  authorLogin: string | null;
  publishedAt: string | null;
  htmlUrl: string;
  isPersonal: boolean;
};

export type Coverage = {
  complete: boolean;
  /** Commits with no linked GitHub account and no matching email. */
  unattributedCommits: number;
  note: string | null;
};

export type Activity = {
  owner: string;
  repo: string;
  directCommits: Commit[];
  pullRequests: PullRequest[];
  issues: Issue[];
  releases: Release[];
  coverage: Coverage;
};

// --- Raw API shapes (minimal subset we read) ---------------------------------

export type RawCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name?: string | null; email?: string | null; date?: string | null } | null;
    committer: { date?: string | null } | null;
  };
  author: { login: string } | null;
};

export type RawReview = {
  id: number;
  state: string;
  body: string | null;
  submitted_at: string | null;
  html_url: string;
  user: { login: string } | null;
};

export type RawPull = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  head: { ref: string };
};

export type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  /** Present only when this "issue" is actually a pull request. */
  pull_request?: unknown;
};

export type RawRelease = {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string | null;
  created_at: string;
  author: { login: string } | null;
};

// --- Pure normalization (unit-tested) ----------------------------------------

function loginIsPersonal(login: string | null, identity: Identity): boolean {
  return login !== null && identity.logins.has(login.toLowerCase());
}

export function normalizeCommit(raw: RawCommit, identity: Identity): Commit {
  const authorLogin = raw.author?.login ?? null;
  const authorEmail = raw.commit.author?.email ?? null;
  const message = raw.commit.message;

  return {
    sha: raw.sha,
    message,
    authorLogin,
    authorEmail,
    authoredAt: raw.commit.author?.date ?? null,
    committedAt: raw.commit.committer?.date ?? null,
    htmlUrl: raw.html_url,
    attribution: resolveAttribution({ authorLogin, authorEmail, message }, identity),
  };
}

export function normalizeReview(raw: RawReview, identity: Identity): Review {
  const authorLogin = raw.user?.login ?? null;
  return {
    id: raw.id,
    authorLogin,
    state: raw.state,
    body: raw.body ?? "",
    submittedAt: raw.submitted_at,
    htmlUrl: raw.html_url,
    isPersonal: loginIsPersonal(authorLogin, identity),
  };
}

export function normalizePullRequest(
  raw: RawPull,
  rawCommits: RawCommit[],
  rawReviews: RawReview[],
  identity: Identity,
): PullRequest {
  const authorLogin = raw.user?.login ?? null;
  const commits = rawCommits.map((c) => normalizeCommit(c, identity));
  const reviews = rawReviews.map((r) => normalizeReview(r, identity));

  const roles: PersonalRole[] = [];
  if (loginIsPersonal(authorLogin, identity)) roles.push("author");
  if (reviews.some((r) => r.isPersonal)) roles.push("reviewer");
  if (commits.some((c) => c.attribution.isPersonal)) roles.push("commit");

  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    state: raw.state,
    authorLogin,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.closed_at,
    mergedAt: raw.merged_at,
    headRef: raw.head.ref,
    htmlUrl: raw.html_url,
    commits,
    reviews,
    personalRoles: roles,
    isPersonal: roles.length > 0,
  };
}

export function normalizeIssue(raw: RawIssue, identity: Identity): Issue {
  const authorLogin = raw.user?.login ?? null;
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    state: raw.state,
    authorLogin,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.closed_at,
    htmlUrl: raw.html_url,
    isPersonal: loginIsPersonal(authorLogin, identity),
  };
}

export function normalizeRelease(raw: RawRelease, identity: Identity): Release {
  const authorLogin = raw.author?.login ?? null;
  return {
    tagName: raw.tag_name,
    name: raw.name ?? raw.tag_name,
    body: raw.body ?? "",
    isPrerelease: raw.prerelease,
    authorLogin,
    publishedAt: raw.published_at,
    htmlUrl: raw.html_url,
    isPersonal: loginIsPersonal(authorLogin, identity),
  };
}

/**
 * A commit is "unattributed" when its author has no linked GitHub account and no
 * email that matches the identity. Those are the ones we can neither confirm nor
 * deny as personal, so they are the honest measure of coverage. A commit clearly
 * authored by someone else (a login that resolved to another account) is not a
 * gap; it's simply not the person's.
 */
export function computeCoverage(commits: Commit[]): Coverage {
  const unattributed = commits.filter(
    (c) => c.authorLogin === null && !c.attribution.isPersonal,
  ).length;

  if (unattributed === 0) {
    return { complete: true, unattributedCommits: 0, note: null };
  }

  return {
    complete: false,
    unattributedCommits: unattributed,
    note: `${unattributed} commit(s) could not be tied to a GitHub account or a known email, so their authorship is uncertain. Add the email addresses you commit with to improve coverage.`,
  };
}

/** True when an ISO timestamp falls within the window. Null dates are excluded. */
export function inPeriod(iso: string | null, period: Period): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= period.start.getTime() && t <= period.end.getTime();
}

// --- Orchestration (network) --------------------------------------------------

/**
 * A pull request counts as belonging to the window when its creation, last
 * update, or merge falls inside it. Using all three avoids missing a PR that was
 * opened before the window but merged inside it, or vice versa.
 */
function pullTouchesPeriod(raw: RawPull, period: Period): boolean {
  return (
    inPeriod(raw.created_at, period) ||
    inPeriod(raw.updated_at, period) ||
    inPeriod(raw.merged_at, period)
  );
}

export async function fetchActivity(
  client: Octokit,
  args: { owner: string; repo: string; period: Period; identity: Identity },
): Promise<Activity> {
  const { owner, repo, period, identity } = args;
  const since = period.start.toISOString();
  const until = period.end.toISOString();

  const rawCommits = (await client.paginate(client.rest.repos.listCommits, {
    owner,
    repo,
    since,
    until,
    per_page: 100,
  })) as unknown as RawCommit[];

  const allPulls = (await client.paginate(client.rest.pulls.list, {
    owner,
    repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  })) as unknown as RawPull[];
  const pullsInPeriod = allPulls.filter((p) => pullTouchesPeriod(p, period));

  // PR-first: each PR's commits come from its own endpoint, not from guessing.
  const pullRequests: PullRequest[] = [];
  const claimedShas = new Set<string>();
  for (const raw of pullsInPeriod) {
    const [prCommits, prReviews] = await Promise.all([
      client.paginate(client.rest.pulls.listCommits, {
        owner,
        repo,
        pull_number: raw.number,
        per_page: 100,
      }) as unknown as Promise<RawCommit[]>,
      client.paginate(client.rest.pulls.listReviews, {
        owner,
        repo,
        pull_number: raw.number,
        per_page: 100,
      }) as unknown as Promise<RawReview[]>,
    ]);

    for (const c of prCommits) claimedShas.add(c.sha);
    pullRequests.push(
      normalizePullRequest(raw, prCommits, prReviews, identity),
    );
  }

  const directCommits = rawCommits
    .filter((c) => !claimedShas.has(c.sha))
    .map((c) => normalizeCommit(c, identity));

  const allIssues = (await client.paginate(client.rest.issues.listForRepo, {
    owner,
    repo,
    since,
    state: "all",
    per_page: 100,
  })) as unknown as RawIssue[];
  // The issues endpoint also returns pull requests; drop those.
  const issues = allIssues
    .filter((i) => i.pull_request === undefined)
    .filter((i) => inPeriod(i.updated_at, period))
    .map((i) => normalizeIssue(i, identity));

  const allReleases = (await client.paginate(client.rest.repos.listReleases, {
    owner,
    repo,
    per_page: 100,
  })) as unknown as RawRelease[];
  const releases = allReleases
    .filter((r) => !r.draft && inPeriod(r.published_at, period))
    .map((r) => normalizeRelease(r, identity));

  // Coverage is measured over every commit we saw, grouped or not.
  const everyCommit = [
    ...directCommits,
    ...pullRequests.flatMap((p) => p.commits),
  ];

  return {
    owner,
    repo,
    directCommits,
    pullRequests,
    issues,
    releases,
    coverage: computeCoverage(everyCommit),
  };
}
