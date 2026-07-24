import { describe, expect, it } from "vitest";

import {
  makeEvidenceItem,
  type EvidenceClassification,
  type EvidenceItem,
  type EvidenceKind,
  type EvidenceWorkState,
} from "@/lib/evidence/evidence";
import type { ReportClaim, ReportDraft, ReportSection } from "@/lib/report/schema";
import { validateReport, type ValidationIssue } from "@/lib/report/validator";

let counter = 0;

/** Evidence item with sensible defaults; each gets a distinct source URL. */
function evi(overrides: {
  id?: string;
  kind?: EvidenceKind;
  workState?: EvidenceWorkState;
  sourceUrl?: string | null;
  sha?: string | null;
  classification?: EvidenceClassification;
} = {}): EvidenceItem {
  counter += 1;
  return makeEvidenceItem({
    kind: overrides.kind ?? "pull_request",
    repository: "acme/app",
    title: `Item ${counter}`,
    sourceUrl:
      overrides.sourceUrl === undefined
        ? `https://github.com/acme/app/pull/${counter}`
        : overrides.sourceUrl,
    sha: overrides.sha ?? null,
    classification: overrides.classification ?? "fact",
    workState: overrides.workState ?? "other",
    id: overrides.id,
  });
}

function claim(
  text: string,
  classification: EvidenceClassification,
  evidenceIds: string[],
): ReportClaim {
  return { text, classification, evidenceIds };
}

function draft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    title: "Report",
    periodLabel: "Jul 2026",
    executiveSummary: [],
    executiveSections: [],
    technicalAppendix: [],
    caveats: [],
    ...overrides,
  };
}

function section(title: string, claims: ReportClaim[]): ReportSection {
  return { title, claims };
}

const types = (issues: ValidationIssue[]) => issues.map((i) => i.type);

describe("validateReport: a well-formed report", () => {
  it("produces no issues when every claim is backed and coverage is balanced", () => {
    const shipped = evi({ workState: "delivered" });
    const wip = evi({ kind: "branch", workState: "in_progress" });

    const report = draft({
      executiveSummary: [
        claim("Shipped the thing", "fact", [shipped.id]),
        claim("Still building the other thing", "fact", [wip.id]),
      ],
    });

    expect(validateReport(report, [shipped, wip])).toEqual([]);
  });
});

describe("validateReport: each issue in isolation", () => {
  it("report_without_claims when the executive summary is empty", () => {
    const commit = evi({ kind: "commit", workState: "other" });
    const report = draft({
      executiveSections: [section("S", [claim("x", "fact", [commit.id])])],
    });
    expect(types(validateReport(report, [commit]))).toEqual(["report_without_claims"]);
  });

  it("duplicate_evidence_id when two items share an id", () => {
    const a = evi({ id: "evi_dup", workState: "delivered" });
    const b = evi({ id: "evi_dup", workState: "delivered" });
    const report = draft({
      executiveSummary: [claim("Shipped", "fact", ["evi_dup"])],
    });
    expect(types(validateReport(report, [a, b]))).toEqual(["duplicate_evidence_id"]);
  });

  it("evidence_without_source for a non-context item with no url and no sha", () => {
    const sourceless = evi({ kind: "commit", sourceUrl: null, sha: null });
    const report = draft({
      executiveSummary: [claim("x", "fact", [sourceless.id])],
    });
    expect(types(validateReport(report, [sourceless]))).toEqual(["evidence_without_source"]);
  });

  it("empty_claim for whitespace-only text", () => {
    const a = evi({ workState: "delivered" });
    const report = draft({ executiveSummary: [claim("   ", "fact", [a.id])] });
    expect(types(validateReport(report, [a]))).toEqual(["empty_claim"]);
  });

  it("claim_without_evidence when a claim cites nothing", () => {
    const a = evi({ workState: "delivered" });
    const report = draft({
      executiveSummary: [
        claim("Shipped", "fact", [a.id]),
        claim("Unsupported", "inference", []),
      ],
    });
    expect(types(validateReport(report, [a]))).toEqual(["claim_without_evidence"]);
  });

  it("unknown_evidence_id when a claim cites a missing id", () => {
    const a = evi({ workState: "delivered" });
    const report = draft({
      executiveSummary: [
        claim("Shipped", "fact", [a.id]),
        claim("Ghost", "inference", ["evi_ghost"]),
      ],
    });
    const issues = validateReport(report, [a]);
    expect(types(issues)).toEqual(["unknown_evidence_id"]);
    expect(issues[0]).toMatchObject({ evidenceId: "evi_ghost", claimIndex: 1 });
  });

  it("context_claim_without_context_evidence when a context claim cites only GitHub items", () => {
    const a = evi({ workState: "delivered" });
    const report = draft({
      executiveSummary: [
        claim("Shipped", "fact", [a.id]),
        claim("The user said so", "context", [a.id]),
      ],
    });
    expect(types(validateReport(report, [a]))).toEqual([
      "context_claim_without_context_evidence",
    ]);
  });

  it("factual_claim_without_github_evidence when a fact cites only user context", () => {
    const userContext = evi({ kind: "user_context", sourceUrl: null });
    const report = draft({
      executiveSummary: [claim("A fact", "fact", [userContext.id])],
    });
    expect(types(validateReport(report, [userContext]))).toEqual([
      "factual_claim_without_github_evidence",
    ]);
  });

  it("missing_delivered_work_coverage when delivered work is never claimed on its own", () => {
    const shipped = evi({ workState: "delivered" });
    const wip = evi({ kind: "branch", workState: "in_progress" });
    const report = draft({
      executiveSummary: [
        claim("Mixed", "fact", [shipped.id, wip.id]),
        claim("Only WIP", "fact", [wip.id]),
      ],
    });
    expect(types(validateReport(report, [shipped, wip]))).toEqual([
      "missing_delivered_work_coverage",
    ]);
  });

  it("missing_work_in_progress_coverage when in-progress work is never claimed on its own", () => {
    const shipped = evi({ workState: "delivered" });
    const wip = evi({ kind: "branch", workState: "in_progress" });
    const report = draft({
      executiveSummary: [
        claim("Mixed", "fact", [shipped.id, wip.id]),
        claim("Only shipped", "fact", [shipped.id]),
      ],
    });
    expect(types(validateReport(report, [shipped, wip]))).toEqual([
      "missing_work_in_progress_coverage",
    ]);
  });
});

describe("validateReport: the core guarantee", () => {
  // The whole point of the product: a fabricated claim, citing evidence that
  // doesn't exist, must be caught. It's what makes the report trustworthy.
  it("blocks a report whose claim cites invented evidence", () => {
    const real = evi({ workState: "delivered" });
    const report = draft({
      executiveSummary: [
        claim("Real, shipped work", "fact", [real.id]),
        claim("I also cured cancer", "fact", ["evi_fabricated"]),
      ],
    });

    const issues = validateReport(report, [real]);
    expect(issues.length).toBeGreaterThan(0);
    expect(types(issues)).toContain("unknown_evidence_id");
  });
});
