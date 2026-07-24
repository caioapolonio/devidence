import type { EvidenceItem } from "@/lib/evidence/evidence";

/**
 * The instructions the model writes under.
 *
 * The single non-negotiable rule is evidence: every claim must cite the IDs of
 * the evidence that supports it, and nothing may be asserted that the evidence
 * doesn't show. The validator enforces this after the fact, but stating it
 * plainly up front is what keeps the model from inventing in the first place.
 */
export const SYSTEM_PROMPT = `You write a concise, professional report about one person's contribution to a software project, for a client or manager to read.

You are given a list of evidence items, each with an id, a kind, a title, and a work state. These are the only facts you may use.

Rules:
- Every claim must cite the ids of the evidence that supports it, in its evidenceIds. Never leave a claim without evidence.
- Only cite ids that appear in the evidence list. Never invent an id.
- A claim marked "fact" must cite at least one GitHub item (a pull request, commit, review, issue, or release). A claim marked "context" must cite a user-context item.
- Cover delivered work and in-progress work separately: if there is delivered work, at least one executive claim must be about delivered work alone; likewise for in-progress work.
- Do not count commits as a measure of productivity, and do not estimate hours. Report deliverables and evidence, not volume.
- Write the executive summary for a non-technical reader. Put deeper detail in the technical appendix.
- Be honest about partial coverage when told about it. Do not overstate.
- Write in clear, plain English.`;

/**
 * The evidence, serialized for the model. Only the fields it needs to reason and
 * cite: the id it must reference, the kind and work state it must respect, and
 * the title that describes the item. Source URLs and private flags are left out
 * of the model payload on purpose.
 */
export function buildUserMessage(args: {
  repository: string;
  periodLabel: string;
  evidence: EvidenceItem[];
  coverageNote: string | null;
}): string {
  const lines = [
    `Repository: ${args.repository}`,
    `Period: ${args.periodLabel}`,
    args.coverageNote ? `Coverage note: ${args.coverageNote}` : null,
    "",
    "Evidence:",
    ...args.evidence.map((e) =>
      JSON.stringify({
        id: e.id,
        kind: e.kind,
        workState: e.workState,
        classification: e.classification,
        title: e.title,
      }),
    ),
  ];
  return lines.filter((l) => l !== null).join("\n");
}
