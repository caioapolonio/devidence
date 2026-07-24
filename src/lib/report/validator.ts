import type { EvidenceItem } from "@/lib/evidence/evidence";

import type { ReportClaim, ReportDraft } from "@/lib/report/schema";

/**
 * The report validator.
 *
 * A faithful port of `ReportValidator` from `ReportModels.swift`, and the heart
 * of the product's promise: a report with a claim that isn't backed by evidence
 * is *blocked*, not merely flagged. The generator runs this after the model
 * answers and refuses to hand back a draft that produces any issue.
 *
 * The ten issue kinds are the macOS app's, one for one. The order they're
 * appended in is preserved so results are predictable and testable.
 */
export type ValidationIssue =
  | { type: "report_without_claims" }
  | { type: "duplicate_evidence_id"; id: string }
  | { type: "evidence_without_source"; id: string }
  | { type: "empty_claim"; section: string; claimIndex: number }
  | { type: "claim_without_evidence"; section: string; claimIndex: number }
  | {
      type: "unknown_evidence_id";
      section: string;
      claimIndex: number;
      evidenceId: string;
    }
  | {
      type: "context_claim_without_context_evidence";
      section: string;
      claimIndex: number;
    }
  | {
      type: "factual_claim_without_github_evidence";
      section: string;
      claimIndex: number;
    }
  | { type: "missing_delivered_work_coverage" }
  | { type: "missing_work_in_progress_coverage" };

const EXECUTIVE_SUMMARY_TITLE = "Executive summary";

export function validateReport(
  draft: ReportDraft,
  evidence: EvidenceItem[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const knownIds = new Set<string>();
  const evidenceById = new Map<string, EvidenceItem>();

  // First pass over evidence: catch duplicates and sourceless items, and build
  // the lookup the claim checks depend on. First writer wins, matching the app.
  for (const item of evidence) {
    if (knownIds.has(item.id)) {
      issues.push({ type: "duplicate_evidence_id", id: item.id });
    } else {
      knownIds.add(item.id);
    }
    if (!evidenceById.has(item.id)) evidenceById.set(item.id, item);

    const hasNoSha = item.sha === null || item.sha.trim().length === 0;
    if (item.kind !== "user_context" && item.sourceUrl === null && hasNoSha) {
      issues.push({ type: "evidence_without_source", id: item.id });
    }
  }

  const executiveClaims = [
    ...draft.executiveSummary,
    ...draft.executiveSections.flatMap((s) => s.claims),
  ];

  // A technical appendix alone is not an executive report.
  if (draft.executiveSummary.length === 0) {
    issues.push({ type: "report_without_claims" });
  }

  const hasDelivered = evidence.some((e) => e.workState === "delivered");
  const hasInProgress = evidence.some((e) => e.workState === "in_progress");

  const hasDeliveredOnlyClaim = executiveClaims.some((claim) => {
    const states = citedWorkStates(claim, evidenceById);
    return states.has("delivered") && !states.has("in_progress");
  });
  const hasInProgressOnlyClaim = executiveClaims.some((claim) => {
    const states = citedWorkStates(claim, evidenceById);
    return states.has("in_progress") && !states.has("delivered");
  });

  if (hasDelivered && !hasDeliveredOnlyClaim) {
    issues.push({ type: "missing_delivered_work_coverage" });
  }
  if (hasInProgress && !hasInProgressOnlyClaim) {
    issues.push({ type: "missing_work_in_progress_coverage" });
  }

  validateClaims(draft.executiveSummary, EXECUTIVE_SUMMARY_TITLE, knownIds, evidenceById, issues);
  for (const section of [...draft.executiveSections, ...draft.technicalAppendix]) {
    validateClaims(section.claims, section.title, knownIds, evidenceById, issues);
  }

  return issues;
}

function citedWorkStates(
  claim: ReportClaim,
  evidenceById: Map<string, EvidenceItem>,
): Set<string> {
  const states = new Set<string>();
  for (const id of claim.evidenceIds) {
    const item = evidenceById.get(id);
    if (item) states.add(item.workState);
  }
  return states;
}

function validateClaims(
  claims: ReportClaim[],
  sectionTitle: string,
  knownIds: Set<string>,
  evidenceById: Map<string, EvidenceItem>,
  issues: ValidationIssue[],
): void {
  claims.forEach((claim, claimIndex) => {
    if (claim.text.trim().length === 0) {
      issues.push({ type: "empty_claim", section: sectionTitle, claimIndex });
    }
    if (claim.evidenceIds.length === 0) {
      issues.push({ type: "claim_without_evidence", section: sectionTitle, claimIndex });
    }
    for (const evidenceId of claim.evidenceIds) {
      if (!knownIds.has(evidenceId)) {
        issues.push({
          type: "unknown_evidence_id",
          section: sectionTitle,
          claimIndex,
          evidenceId,
        });
      }
    }

    const cited = claim.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((item): item is EvidenceItem => item !== undefined);

    // A "context" claim must cite something the user supplied; a "fact" claim
    // must cite something from GitHub. This is what keeps the two from swapping.
    if (
      claim.classification === "context" &&
      !cited.some((item) => item.kind === "user_context")
    ) {
      issues.push({
        type: "context_claim_without_context_evidence",
        section: sectionTitle,
        claimIndex,
      });
    }
    if (
      claim.classification === "fact" &&
      !cited.some((item) => item.kind !== "user_context")
    ) {
      issues.push({
        type: "factual_claim_without_github_evidence",
        section: sectionTitle,
        claimIndex,
      });
    }
  });
}
