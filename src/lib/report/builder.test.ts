import { describe, expect, it } from "vitest";

import type {
  Activity,
  Commit,
  Issue,
  PullRequest,
  Release,
  Review,
} from "@/lib/github/activity";
import { buildEvidence, MAX_EVIDENCE_ITEMS } from "@/lib/report/builder";

function commit(personal: boolean, sha: string): Commit {
  return {
    sha,
    message: `Work on ${sha}\n\nbody`,
    authorLogin: personal ? "caio" : "someone",
    authorEmail: null,
    authoredAt: "2026-07-20T00:00:00Z",
    committedAt: "2026-07-20T00:00:00Z",
    htmlUrl: `https://github.com/acme/app/commit/${sha}`,
    attribution: { isPersonal: personal, reason: personal ? "github_login" : "none" },
  };
}

function review(personal: boolean, id: number): Review {
  return {
    id,
    authorLogin: personal ? "caio" : "someone",
    state: "APPROVED",
    body: "LGTM",
    submittedAt: "2026-07-20T00:00:00Z",
    htmlUrl: `https://github.com/acme/app/pull/1#r${id}`,
    isPersonal: personal,
  };
}

function pull(overrides: Partial<PullRequest> = {}): PullRequest {
  const number = overrides.number ?? 1;
  return {
    number,
    title: "A feature",
    body: "Body text",
    state: "closed",
    authorLogin: "caio",
    createdAt: "2026-07-18T00:00:00Z",
    updatedAt: "2026-07-20T00:00:00Z",
    closedAt: "2026-07-20T00:00:00Z",
    mergedAt: "2026-07-20T00:00:00Z",
    headRef: "feature",
    // Derived from the number so two PRs don't collide on the same stable id.
    htmlUrl: `https://github.com/acme/app/pull/${number}`,
    commits: [],
    reviews: [],
    personalRoles: ["author"],
    isPersonal: true,
    ...overrides,
  };
}

function issue(personal: boolean, number: number): Issue {
  return {
    number,
    title: "A bug",
    body: "",
    state: "open",
    authorLogin: personal ? "caio" : "someone",
    createdAt: "2026-07-19T00:00:00Z",
    updatedAt: "2026-07-19T00:00:00Z",
    closedAt: null,
    htmlUrl: `https://github.com/acme/app/issues/${number}`,
    isPersonal: personal,
  };
}

function release(personal: boolean, tag: string): Release {
  return {
    tagName: tag,
    name: `Release ${tag}`,
    body: "",
    isPrerelease: false,
    authorLogin: personal ? "caio" : "someone",
    publishedAt: "2026-07-19T00:00:00Z",
    htmlUrl: `https://github.com/acme/app/releases/${tag}`,
    isPersonal: personal,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    owner: "acme",
    repo: "app",
    directCommits: [],
    pullRequests: [],
    issues: [],
    releases: [],
    coverage: { complete: true, unattributedCommits: 0, note: null },
    ...overrides,
  };
}

describe("buildEvidence", () => {
  it("includes only personal items", () => {
    const payload = buildEvidence(
      activity({
        directCommits: [commit(true, "mine"), commit(false, "theirs")],
        issues: [issue(true, 1), issue(false, 2)],
        releases: [release(true, "v1"), release(false, "v2")],
      }),
    );

    const titles = payload.evidence.map((e) => e.title);
    expect(titles.some((t) => t.includes("mine"))).toBe(true);
    expect(titles.some((t) => t.includes("theirs"))).toBe(false);
    expect(titles.some((t) => t.includes("#2"))).toBe(false);
    expect(titles.some((t) => t.includes("v2"))).toBe(false);
    // 1 commit + 1 issue + 1 release.
    expect(payload.evidence).toHaveLength(3);
  });

  it("marks work state from the data, not a title marker", () => {
    const payload = buildEvidence(
      activity({
        releases: [release(true, "v1")],
        pullRequests: [
          pull({ number: 10, mergedAt: "2026-07-20T00:00:00Z", state: "closed" }),
          pull({ number: 11, mergedAt: null, state: "open" }),
        ],
      }),
    );

    const byTitle = (needle: string) =>
      payload.evidence.find((e) => e.title.includes(needle));

    expect(byTitle("Release v1")?.workState).toBe("delivered");
    expect(byTitle("PR #10")?.workState).toBe("delivered");
    expect(byTitle("PR #11")?.workState).toBe("in_progress");
    expect(byTitle("PR #10")?.title).toContain("(delivered)");
    expect(byTitle("PR #11")?.title).toContain("(in progress)");
  });

  it("pulls personal reviews and commits out of a personal PR", () => {
    const payload = buildEvidence(
      activity({
        pullRequests: [
          pull({
            number: 5,
            reviews: [review(true, 100), review(false, 101)],
            commits: [commit(true, "c1"), commit(false, "c2")],
          }),
        ],
      }),
    );

    const kinds = payload.evidence.map((e) => e.kind);
    expect(kinds.filter((k) => k === "review")).toHaveLength(1);
    expect(kinds.filter((k) => k === "commit")).toHaveLength(1);
    expect(payload.evidence.some((e) => e.title.includes("c2"))).toBe(false);
  });

  it("adds user context as a context evidence item", () => {
    const payload = buildEvidence(activity(), { userContext: "This was a rush job for a client demo." });
    const ctx = payload.evidence.find((e) => e.kind === "user_context");
    expect(ctx).toBeDefined();
    expect(ctx?.classification).toBe("context");
    expect(ctx?.title).toContain("rush job");
  });

  it("dedupes a commit reached both directly and through a PR", () => {
    const shared = commit(true, "shared");
    const payload = buildEvidence(
      activity({
        directCommits: [shared],
        pullRequests: [pull({ commits: [shared] })],
      }),
    );
    const commitItems = payload.evidence.filter((e) => e.kind === "commit");
    expect(commitItems).toHaveLength(1);
  });

  it("propagates a coverage note", () => {
    const payload = buildEvidence(
      activity({
        directCommits: [commit(true, "x")],
        coverage: { complete: false, unattributedCommits: 3, note: "3 uncertain" },
      }),
    );
    expect(payload.coverageNote).toBe("3 uncertain");
  });

  it("bounds the item count and drops low-priority commits first", () => {
    const manyCommits = Array.from({ length: MAX_EVIDENCE_ITEMS + 50 }, (_, i) =>
      commit(true, `c${i}`),
    );
    const payload = buildEvidence(
      activity({
        releases: [release(true, "v1")],
        directCommits: manyCommits,
      }),
    );

    // 1 release + (MAX + 50) commits = MAX + 51 items; 51 fall off.
    expect(payload.evidence).toHaveLength(MAX_EVIDENCE_ITEMS);
    expect(payload.excludedCount).toBe(51);
    // The release outranks commits, so it survives the cut.
    expect(payload.evidence.some((e) => e.kind === "release")).toBe(true);
    expect(payload.evidence[0].kind).toBe("release");
  });
});
