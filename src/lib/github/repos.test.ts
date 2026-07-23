import { describe, expect, it } from "vitest";

import {
  filterRepositories,
  normalizeRepository,
  sortByRecentActivity,
  type RawRepository,
  type Repository,
} from "@/lib/github/repos";

function raw(overrides: Partial<RawRepository> = {}): RawRepository {
  return {
    id: 1,
    name: "devidence",
    full_name: "caioapolonio/devidence",
    owner: { login: "caioapolonio" },
    private: false,
    archived: false,
    fork: false,
    default_branch: "main",
    html_url: "https://github.com/caioapolonio/devidence",
    pushed_at: "2026-07-22T12:00:00Z",
    description: null,
    ...overrides,
  };
}

function repo(overrides: Partial<Repository> = {}): Repository {
  return { ...normalizeRepository(raw()), ...overrides };
}

describe("normalizeRepository", () => {
  it("keeps only the fields the app uses", () => {
    expect(normalizeRepository(raw())).toEqual({
      id: 1,
      name: "devidence",
      fullName: "caioapolonio/devidence",
      owner: "caioapolonio",
      isPrivate: false,
      isArchived: false,
      isFork: false,
      defaultBranch: "main",
      htmlUrl: "https://github.com/caioapolonio/devidence",
      pushedAt: "2026-07-22T12:00:00Z",
      description: null,
    });
  });

  it("derives the owner from full_name when owner comes back null", () => {
    const normalized = normalizeRepository(raw({ owner: null }));
    expect(normalized.owner).toBe("caioapolonio");
  });

  it("preserves the private-repository signal", () => {
    expect(normalizeRepository(raw({ private: true })).isPrivate).toBe(true);
  });
});

describe("sortByRecentActivity", () => {
  it("puts the most recent first", () => {
    const sorted = sortByRecentActivity([
      repo({ fullName: "a/old", pushedAt: "2025-01-01T00:00:00Z" }),
      repo({ fullName: "a/new", pushedAt: "2026-07-01T00:00:00Z" }),
      repo({ fullName: "a/mid", pushedAt: "2026-01-01T00:00:00Z" }),
    ]);

    expect(sorted.map((r) => r.fullName)).toEqual(["a/new", "a/mid", "a/old"]);
  });

  it("sends a repository with no pushes to the end, without dropping it", () => {
    const sorted = sortByRecentActivity([
      repo({ fullName: "a/empty", pushedAt: null }),
      repo({ fullName: "a/active", pushedAt: "2026-07-01T00:00:00Z" }),
    ]);

    expect(sorted.map((r) => r.fullName)).toEqual(["a/active", "a/empty"]);
    expect(sorted).toHaveLength(2);
  });

  it("breaks ties by name so the order is stable", () => {
    const sameDate = "2026-07-01T00:00:00Z";
    const sorted = sortByRecentActivity([
      repo({ fullName: "z/project", pushedAt: sameDate }),
      repo({ fullName: "a/project", pushedAt: sameDate }),
    ]);

    expect(sorted.map((r) => r.fullName)).toEqual(["a/project", "z/project"]);
  });

  it("does not mutate the given array", () => {
    const original = [
      repo({ fullName: "a/old", pushedAt: "2025-01-01T00:00:00Z" }),
      repo({ fullName: "a/new", pushedAt: "2026-07-01T00:00:00Z" }),
    ];
    sortByRecentActivity(original);
    expect(original[0].fullName).toBe("a/old");
  });
});

describe("filterRepositories", () => {
  const repositories = [
    repo({ fullName: "caioapolonio/devidence", description: "Reports" }),
    repo({ fullName: "caioapolonio/cinebaltar", description: null }),
    repo({ fullName: "company/API-Payments", description: "Cobrança" }),
  ];

  it("returns everything when the query is empty", () => {
    expect(filterRepositories(repositories, "   ")).toHaveLength(3);
  });

  it("ignores case", () => {
    const found = filterRepositories(repositories, "api-payments");
    expect(found.map((r) => r.fullName)).toEqual(["company/API-Payments"]);
  });

  it("ignores accents in both directions", () => {
    const withAccent = filterRepositories(repositories, "cobrança");
    const withoutAccent = filterRepositories(repositories, "cobranca");
    expect(withAccent.map((r) => r.fullName)).toEqual(["company/API-Payments"]);
    expect(withoutAccent.map((r) => r.fullName)).toEqual(["company/API-Payments"]);
  });

  it("also searches the description", () => {
    const found = filterRepositories(repositories, "reports");
    expect(found.map((r) => r.fullName)).toEqual(["caioapolonio/devidence"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterRepositories(repositories, "nonexistent")).toEqual([]);
  });
});
