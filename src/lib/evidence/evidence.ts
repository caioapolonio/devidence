import { createHash } from "node:crypto";

/**
 * A locally sourced item a generated report is allowed to cite.
 *
 * Ported from `EvidenceModels.swift`. The identifier is derived from immutable
 * source coordinates, not a database row, so the same GitHub item always
 * produces the same ID. That stability is what lets a report claim reference
 * evidence by ID and be re-checked later.
 */

export type EvidenceKind =
  | "pull_request"
  | "commit"
  | "review"
  | "issue"
  | "release"
  | "branch"
  | "user_context";

/**
 * Whether a claim states a fact backed by GitHub data, an inference drawn from
 * it, or context the user supplied. The report validator uses this to keep
 * inferences from masquerading as facts.
 */
export type EvidenceClassification = "fact" | "inference" | "context";

export type EvidenceItem = {
  id: string;
  kind: EvidenceKind;
  repository: string;
  title: string;
  sourceUrl: string | null;
  sha: string | null;
  isPrivateSource: boolean | null;
  classification: EvidenceClassification;
};

// U+001F, the field separator the macOS app joins coordinates with. Written as
// an escape so no invisible control character sits in the source.
const UNIT_SEPARATOR = "\u001F";

/**
 * Canonical source coordinates only: URL stripped of credentials, query, and
 * fragment; repository trimmed and lowercased; sha lowercased. Two views of the
 * same item that differ only in title, casing, or a signed-URL query parameter
 * collapse to the same ID.
 */
function canonicalUrl(url: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().trim();
  } catch {
    return "";
  }
}

export function makeStableId(args: {
  kind: EvidenceKind;
  repository: string;
  sourceUrl: string | null;
  sha: string | null;
}): string {
  const source = [
    args.kind,
    args.repository.trim().toLowerCase(),
    canonicalUrl(args.sourceUrl),
    args.sha?.trim().toLowerCase() ?? "",
  ].join(UNIT_SEPARATOR);

  const digest = createHash("sha256").update(source, "utf8").digest("hex");
  return "evi_" + digest.slice(0, 24);
}

export function makeEvidenceItem(args: {
  kind: EvidenceKind;
  repository: string;
  title: string;
  sourceUrl?: string | null;
  sha?: string | null;
  isPrivateSource?: boolean | null;
  classification: EvidenceClassification;
  id?: string;
}): EvidenceItem {
  const sourceUrl = args.sourceUrl ?? null;
  const sha = args.sha ?? null;
  return {
    id: args.id ?? makeStableId({ kind: args.kind, repository: args.repository, sourceUrl, sha }),
    kind: args.kind,
    repository: args.repository,
    title: args.title,
    sourceUrl,
    sha,
    isPrivateSource: args.isPrivateSource ?? null,
    classification: args.classification,
  };
}
