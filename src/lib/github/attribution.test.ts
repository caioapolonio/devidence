import { describe, expect, it } from "vitest";

import {
  coauthorEmails,
  makeIdentity,
  resolveAttribution,
  type AttributableCommit,
} from "@/lib/github/attribution";

function commit(overrides: Partial<AttributableCommit> = {}): AttributableCommit {
  return {
    authorLogin: "coworker",
    authorEmail: "coworker@example.com",
    message: "A commit",
    ...overrides,
  };
}

describe("resolveAttribution", () => {
  it("attributes by GitHub login, normalized for case", () => {
    const result = resolveAttribution(
      commit({ authorLogin: "Caio" }),
      makeIdentity(["caio", "other-login"], []),
    );
    expect(result).toEqual({ isPersonal: true, reason: "github_login" });
  });

  it("attributes by confirmed email when the login doesn't match", () => {
    const result = resolveAttribution(
      commit({ authorLogin: "coworker", authorEmail: "CAIO@example.com" }),
      makeIdentity([], ["caio@example.com"]),
    );
    expect(result).toEqual({ isPersonal: true, reason: "confirmed_email" });
  });

  it("prefers login over email when both would match", () => {
    const result = resolveAttribution(
      commit({ authorLogin: "caio", authorEmail: "caio@example.com" }),
      makeIdentity(["caio"], ["caio@example.com"]),
    );
    expect(result.reason).toBe("github_login");
  });

  // The load-bearing case from the macOS app's CoreDomainTests: a commit
  // authored by a coworker but co-authored by the person. It's personal only
  // through the co-author email, never through the name in the trailer.
  it("attributes a co-authored commit by email only", () => {
    const coAuthored = commit({
      authorLogin: "coworker",
      authorEmail: "coworker@example.com",
      message:
        "Joint delivery\n\nDetails\n\nCo-authored-by: Caio <caio@example.com>",
    });

    expect(resolveAttribution(coAuthored, makeIdentity([], ["caio@example.com"]))).toEqual({
      isPersonal: true,
      reason: "coauthored_email",
    });

    // With the name as a login but no matching email, co-authorship must not
    // attribute: the trailer is matched by email, and the identity email set is
    // empty here.
    expect(resolveAttribution(coAuthored, makeIdentity(["caio"], [])).isPersonal).toBe(
      false,
    );
  });

  it("is not personal when nothing matches", () => {
    const result = resolveAttribution(
      commit(),
      makeIdentity(["caio"], ["caio@example.com"]),
    );
    expect(result).toEqual({ isPersonal: false, reason: "none" });
  });

  it("handles a commit with no author login (unlinked account)", () => {
    const result = resolveAttribution(
      commit({ authorLogin: null, authorEmail: "caio@example.com" }),
      makeIdentity(["caio"], ["caio@example.com"]),
    );
    expect(result).toEqual({ isPersonal: true, reason: "confirmed_email" });
  });
});

describe("coauthorEmails", () => {
  it("extracts the email from a trailer, lowercased", () => {
    expect(coauthorEmails("Co-authored-by: Caio <Caio@Example.com>")).toEqual(
      new Set(["caio@example.com"]),
    );
  });

  it("matches case-insensitively and across lines", () => {
    const message = [
      "Title",
      "",
      "co-authored-by: A <a@example.com>",
      "CO-AUTHORED-BY: B <b@example.com>",
    ].join("\n");
    expect(coauthorEmails(message)).toEqual(
      new Set(["a@example.com", "b@example.com"]),
    );
  });

  it("ignores a trailer with a name but no email in brackets", () => {
    expect(coauthorEmails("Co-authored-by: Someone Without Email")).toEqual(
      new Set(),
    );
  });

  it("returns empty for a message with no trailer", () => {
    expect(coauthorEmails("Just a normal commit message")).toEqual(new Set());
  });

  it("does not match co-authored-by that isn't at the start of a line", () => {
    // A mention inside prose is not a trailer.
    expect(
      coauthorEmails("See the note about Co-authored-by: x <x@example.com> above"),
    ).toEqual(new Set());
  });
});
