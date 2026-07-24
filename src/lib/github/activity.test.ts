import { describe, expect, it } from "vitest";

import { makeIdentity } from "@/lib/github/attribution";
import {
  computeCoverage,
  inPeriod,
  normalizeCommit,
  normalizeIssue,
  normalizePullRequest,
  normalizeRelease,
  normalizeReview,
  type RawCommit,
  type RawIssue,
  type RawPull,
  type RawRelease,
  type RawReview,
} from "@/lib/github/activity";
import { lastDays } from "@/lib/period";

const ME = makeIdentity(["caio"], ["caio@example.com"]);

function rawCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    sha: "abc123",
    html_url: "https://github.com/acme/app/commit/abc123",
    commit: {
      message: "Do a thing",
      author: { name: "Caio", email: "caio@example.com", date: "2026-07-20T10:00:00Z" },
      committer: { date: "2026-07-20T10:05:00Z" },
    },
    author: { login: "caio" },
    ...overrides,
  };
}

describe("normalizeCommit", () => {
  it("extracts fields and resolves attribution", () => {
    const commit = normalizeCommit(rawCommit(), ME);
    expect(commit).toMatchObject({
      sha: "abc123",
      authorLogin: "caio",
      authorEmail: "caio@example.com",
      authoredAt: "2026-07-20T10:00:00Z",
      committedAt: "2026-07-20T10:05:00Z",
      attribution: { isPersonal: true, reason: "github_login" },
    });
  });

  it("handles a commit whose author has no linked account", () => {
    const commit = normalizeCommit(
      rawCommit({ author: null, commit: { message: "x", author: { email: "who@nope.com" }, committer: {} } }),
      ME,
    );
    expect(commit.authorLogin).toBeNull();
    expect(commit.attribution.isPersonal).toBe(false);
  });
});

describe("normalizeReview", () => {
  const rawReview = (login: string | null): RawReview => ({
    id: 1,
    state: "APPROVED",
    body: "LGTM",
    submitted_at: "2026-07-20T11:00:00Z",
    html_url: "https://github.com/acme/app/pull/1#review-1",
    user: login ? { login } : null,
  });

  it("marks a review by the person as personal", () => {
    expect(normalizeReview(rawReview("caio"), ME).isPersonal).toBe(true);
  });

  it("marks a review by someone else as not personal", () => {
    expect(normalizeReview(rawReview("stranger"), ME).isPersonal).toBe(false);
    expect(normalizeReview(rawReview(null), ME).isPersonal).toBe(false);
  });
});

describe("normalizePullRequest", () => {
  const basePull: RawPull = {
    number: 7,
    title: "A feature",
    body: "Body",
    state: "closed",
    html_url: "https://github.com/acme/app/pull/7",
    user: { login: "stranger" },
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    closed_at: "2026-07-20T00:00:00Z",
    merged_at: "2026-07-20T00:00:00Z",
    head: { ref: "feature" },
  };

  it("is personal by authorship when the PR author is the person", () => {
    const pr = normalizePullRequest({ ...basePull, user: { login: "caio" } }, [], [], ME);
    expect(pr.personalRoles).toEqual(["author"]);
    expect(pr.isPersonal).toBe(true);
  });

  it("is personal by review even when someone else opened it", () => {
    const review: RawReview = {
      id: 2,
      state: "APPROVED",
      body: "",
      submitted_at: "2026-07-19T00:00:00Z",
      html_url: "u",
      user: { login: "caio" },
    };
    const pr = normalizePullRequest(basePull, [], [review], ME);
    expect(pr.personalRoles).toEqual(["reviewer"]);
    expect(pr.isPersonal).toBe(true);
  });

  it("is personal by commit even when someone else opened it", () => {
    const pr = normalizePullRequest(basePull, [rawCommit()], [], ME);
    expect(pr.personalRoles).toEqual(["commit"]);
    expect(pr.isPersonal).toBe(true);
  });

  it("can hold all three roles at once", () => {
    const pr = normalizePullRequest(
      { ...basePull, user: { login: "caio" } },
      [rawCommit()],
      [
        {
          id: 3,
          state: "COMMENTED",
          body: "",
          submitted_at: "2026-07-19T00:00:00Z",
          html_url: "u",
          user: { login: "caio" },
        },
      ],
      ME,
    );
    expect(new Set(pr.personalRoles)).toEqual(
      new Set(["author", "reviewer", "commit"]),
    );
  });

  it("is not personal when the person is nowhere in it", () => {
    const pr = normalizePullRequest(
      basePull,
      [rawCommit({ author: { login: "stranger" }, commit: { message: "x", author: { email: "s@x.com" }, committer: {} } })],
      [],
      ME,
    );
    expect(pr.personalRoles).toEqual([]);
    expect(pr.isPersonal).toBe(false);
  });
});

describe("normalizeIssue and normalizeRelease", () => {
  it("attributes an issue by author login", () => {
    const issue: RawIssue = {
      number: 4,
      title: "Bug",
      body: "",
      state: "open",
      html_url: "u",
      user: { login: "caio" },
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
      closed_at: null,
    };
    expect(normalizeIssue(issue, ME).isPersonal).toBe(true);
  });

  it("falls back to the tag when a release has no name", () => {
    const release: RawRelease = {
      tag_name: "v1.2.0",
      name: null,
      body: "",
      draft: false,
      prerelease: false,
      html_url: "u",
      published_at: "2026-07-19T00:00:00Z",
      created_at: "2026-07-19T00:00:00Z",
      author: { login: "caio" },
    };
    const normalized = normalizeRelease(release, ME);
    expect(normalized.name).toBe("v1.2.0");
    expect(normalized.isPersonal).toBe(true);
  });
});

describe("computeCoverage", () => {
  it("is complete when every commit is attributable", () => {
    const commits = [rawCommit(), rawCommit({ sha: "d2" })].map((c) =>
      normalizeCommit(c, ME),
    );
    expect(computeCoverage(commits)).toEqual({
      complete: true,
      unattributedCommits: 0,
      note: null,
    });
  });

  // The honesty signal: a commit with no linked account and no matching email is
  // neither confirmed nor denied. It must be counted, not hidden.
  it("flags commits that can't be tied to an account or a known email", () => {
    const uncertain = normalizeCommit(
      rawCommit({
        sha: "u1",
        author: null,
        commit: { message: "x", author: { email: "unknown@nope.com" }, committer: {} },
      }),
      ME,
    );
    const mine = normalizeCommit(rawCommit(), ME);

    const coverage = computeCoverage([mine, uncertain]);
    expect(coverage.complete).toBe(false);
    expect(coverage.unattributedCommits).toBe(1);
    expect(coverage.note).toContain("uncertain");
  });

  it("does not count a commit clearly authored by someone else as a gap", () => {
    // A login that resolved to another account is known not to be the person.
    const someoneElse = normalizeCommit(
      rawCommit({ sha: "s1", author: { login: "stranger" } }),
      ME,
    );
    expect(computeCoverage([someoneElse]).complete).toBe(true);
  });
});

describe("inPeriod", () => {
  const period = lastDays(30, new Date("2026-07-22T00:00:00Z"));

  it("includes a date inside the window", () => {
    expect(inPeriod("2026-07-10T00:00:00Z", period)).toBe(true);
  });

  it("excludes a date before the window", () => {
    expect(inPeriod("2026-05-01T00:00:00Z", period)).toBe(false);
  });

  it("excludes a null date", () => {
    expect(inPeriod(null, period)).toBe(false);
  });
});
