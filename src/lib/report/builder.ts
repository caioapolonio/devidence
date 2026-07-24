import type { Activity } from "@/lib/github/activity";
import {
  makeEvidenceItem,
  type EvidenceItem,
  type EvidenceKind,
  type EvidenceWorkState,
} from "@/lib/evidence/evidence";

/**
 * Turns a repository's activity into the evidence a report may cite.
 *
 * Ported in spirit from `ReportEvidenceBuilder.swift` and `EvidencePrioritizer.swift`,
 * narrowed to this product's scope: one repository, personal contribution only.
 * The macOS app carried three perspectives and a comparison mode; here the
 * report is always about the person, so only personal items become evidence.
 *
 * The item count is bounded (250) with the same priority order as the native
 * app, so when a busy window overflows the budget it's the low-signal commits
 * that fall off, not a release or a PR.
 */

export const MAX_EVIDENCE_ITEMS = 250;

export type EvidencePayload = {
  repository: string;
  evidence: EvidenceItem[];
  excludedCount: number;
  coverageNote: string | null;
};

const KIND_PRIORITY: Record<EvidenceKind, number> = {
  user_context: 0,
  release: 1,
  pull_request: 2,
  branch: 3,
  review: 4,
  issue: 5,
  commit: 6,
};

function pullWorkState(pr: {
  mergedAt: string | null;
  state: string;
}): EvidenceWorkState {
  if (pr.mergedAt !== null) return "delivered";
  if (pr.state === "open") return "in_progress";
  return "other";
}

function pullStateLabel(pr: { mergedAt: string | null; state: string }): string {
  if (pr.mergedAt !== null) return "delivered";
  if (pr.state === "open") return "in progress";
  return "closed without merge";
}

/** First line of a commit message. */
function headline(message: string): string {
  return message.split("\n", 1)[0];
}

/** Collapses newlines, trims, prefixes with an em-free separator, and caps length. */
function excerpt(text: string, maximum: number): string {
  const normalized = text.replaceAll("\r", " ").replaceAll("\n", " ").trim();
  if (normalized.length === 0) return "";
  return " - " + normalized.slice(0, maximum);
}

export function buildEvidence(
  activity: Activity,
  options: { userContext?: string } = {},
): EvidencePayload {
  const repository = `${activity.owner}/${activity.repo}`;
  const items: EvidenceItem[] = [];

  const push = (args: {
    kind: EvidenceKind;
    title: string;
    sourceUrl?: string | null;
    sha?: string | null;
    workState?: EvidenceWorkState;
    classification?: "fact" | "context";
  }) => {
    items.push(
      makeEvidenceItem({
        kind: args.kind,
        repository,
        title: args.title,
        sourceUrl: args.sourceUrl ?? null,
        sha: args.sha ?? null,
        isPrivateSource: null,
        classification: args.classification ?? "fact",
        workState: args.workState ?? "other",
      }),
    );
  };

  const userContext = options.userContext?.trim();
  if (userContext) {
    push({ kind: "user_context", title: userContext, classification: "context" });
  }

  for (const release of activity.releases) {
    if (!release.isPersonal) continue;
    push({
      kind: "release",
      title: `Release ${release.tagName}: ${release.name}${excerpt(release.body, 500)}`,
      sourceUrl: release.htmlUrl,
      workState: "delivered",
    });
  }

  for (const pr of activity.pullRequests) {
    if (!pr.isPersonal) continue;
    push({
      kind: "pull_request",
      title: `PR #${pr.number} (${pullStateLabel(pr)}): ${pr.title}${excerpt(pr.body, 600)}`,
      sourceUrl: pr.htmlUrl,
      workState: pullWorkState(pr),
    });

    for (const review of pr.reviews) {
      if (!review.isPersonal) continue;
      push({
        kind: "review",
        title: `Review ${review.state} on PR #${pr.number}${excerpt(review.body, 350)}`,
        sourceUrl: review.htmlUrl,
      });
    }

    for (const commit of pr.commits) {
      if (!commit.attribution.isPersonal) continue;
      push({
        kind: "commit",
        title: `Commit from PR #${pr.number}: ${headline(commit.message)}`,
        sourceUrl: commit.htmlUrl,
        sha: commit.sha,
      });
    }
  }

  for (const issue of activity.issues) {
    if (!issue.isPersonal) continue;
    push({
      kind: "issue",
      title: `Issue #${issue.number} [${issue.state}]: ${issue.title}`,
      sourceUrl: issue.htmlUrl,
    });
  }

  for (const commit of activity.directCommits) {
    if (!commit.attribution.isPersonal) continue;
    push({
      kind: "commit",
      title: `Commit direct: ${headline(commit.message)}`,
      sourceUrl: commit.htmlUrl,
      sha: commit.sha,
    });
  }

  // Dedupe by stable id (a commit reached through a PR and directly collapses),
  // first occurrence wins.
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const prioritized = prioritize(unique, MAX_EVIDENCE_ITEMS);

  return {
    repository,
    evidence: prioritized.included,
    excludedCount: prioritized.excludedCount,
    coverageNote: activity.coverage.complete ? null : activity.coverage.note,
  };
}

function prioritize(
  evidence: EvidenceItem[],
  maximumItems: number,
): { included: EvidenceItem[]; excludedCount: number } {
  // Stable sort by kind priority, keeping original order within a kind.
  const ordered = evidence
    .map((element, offset) => ({ element, offset }))
    .sort((a, b) => {
      const pa = KIND_PRIORITY[a.element.kind];
      const pb = KIND_PRIORITY[b.element.kind];
      return pa !== pb ? pa - pb : a.offset - b.offset;
    })
    .map((x) => x.element);

  const included = ordered.slice(0, Math.max(1, maximumItems));
  return {
    included,
    excludedCount: Math.max(ordered.length - included.length, 0),
  };
}
