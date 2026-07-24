import { describe, expect, it } from "vitest";

import { makeEvidenceItem } from "@/lib/evidence/evidence";

describe("makeEvidenceItem: stable, source-sensitive ID", () => {
  const url = "https://github.com/acme/app/pull/42";

  const first = makeEvidenceItem({
    kind: "pull_request",
    repository: "Acme/App",
    title: "First title",
    sourceUrl: url,
    classification: "fact",
  });

  it("ignores repository casing, whitespace, title, and classification", () => {
    const renamed = makeEvidenceItem({
      kind: "pull_request",
      repository: " acme/app ",
      title: "Title changed after sync",
      sourceUrl: url,
      classification: "inference",
    });
    expect(renamed.id).toBe(first.id);
  });

  it("ignores signed-URL query parameters", () => {
    const signed = makeEvidenceItem({
      kind: "pull_request",
      repository: "acme/app",
      title: "Signed URL",
      sourceUrl: `${url}?access_token=secret`,
      classification: "fact",
    });
    expect(signed.id).toBe(first.id);
  });

  it("changes with the source URL", () => {
    const another = makeEvidenceItem({
      kind: "pull_request",
      repository: "acme/app",
      title: "Another PR",
      sourceUrl: "https://github.com/acme/app/pull/43",
      classification: "fact",
    });
    expect(another.id).not.toBe(first.id);
  });

  it("changes with the kind", () => {
    const asCommit = makeEvidenceItem({
      kind: "commit",
      repository: "acme/app",
      title: "Same URL, different kind",
      sourceUrl: url,
      classification: "fact",
    });
    expect(asCommit.id).not.toBe(first.id);
  });

  it("carries the evi_ prefix", () => {
    expect(first.id.startsWith("evi_")).toBe(true);
  });

  it("is deterministic across calls", () => {
    const again = makeEvidenceItem({
      kind: "pull_request",
      repository: "acme/app",
      title: "First title",
      sourceUrl: url,
      classification: "fact",
    });
    expect(again.id).toBe(first.id);
  });
});
