import type { ReportClaim, ReportDraft, ReportSection } from "@/lib/report/schema";

export type UsedEvidence = {
  id: string;
  kind: string;
  title: string;
  sourceUrl: string | null;
};

const CLASSIFICATION_LABEL: Record<ReportClaim["classification"], string> = {
  fact: "fact",
  inference: "inference",
  context: "context",
};

function Claim({ claim }: { claim: ReportClaim }) {
  return (
    <li className="border-l-2 border-black/10 pl-3 dark:border-white/15">
      <p className="text-sm">{claim.text}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-black/40 dark:text-white/40">
        {CLASSIFICATION_LABEL[claim.classification]} · {claim.evidenceIds.length} evidence
      </p>
    </li>
  );
}

function Section({ section }: { section: ReportSection }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{section.title}</h3>
      <ul className="space-y-2">
        {section.claims.map((claim, i) => (
          <Claim key={i} claim={claim} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders a generated draft. Every claim shows its classification and how many
 * evidence items back it, and the evidence actually sent to the model is listed
 * at the bottom: the report is meant to be checkable, so what it's built from is
 * shown, not hidden.
 */
export function ReportView({
  draft,
  evidence,
  coverageNote,
  excludedCount,
}: {
  draft: ReportDraft;
  evidence: UsedEvidence[];
  coverageNote: string | null;
  excludedCount: number;
}) {
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h2 className="text-lg font-semibold">{draft.title}</h2>
        <p className="text-sm text-black/55 dark:text-white/55">{draft.periodLabel}</p>
      </header>

      {coverageNote && (
        <p className="rounded-md bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {coverageNote}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Executive summary</h3>
        <ul className="space-y-2">
          {draft.executiveSummary.map((claim, i) => (
            <Claim key={i} claim={claim} />
          ))}
        </ul>
      </section>

      {draft.executiveSections.map((section, i) => (
        <Section key={i} section={section} />
      ))}

      {draft.technicalAppendix.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-black/60 dark:text-white/60">
            Technical appendix
          </h3>
          {draft.technicalAppendix.map((section, i) => (
            <Section key={i} section={section} />
          ))}
        </section>
      )}

      {draft.caveats.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">Caveats</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/70 dark:text-white/70">
            {draft.caveats.map((caveat, i) => (
              <li key={i}>{caveat}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">
          Evidence sent to the model ({evidence.length}
          {excludedCount > 0 ? `, ${excludedCount} more not sent` : ""})
        </h3>
        <ul className="space-y-1 text-sm">
          {evidence.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-black/40 dark:text-white/40">
                {item.kind.replace("_", " ")}
              </span>
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate underline underline-offset-2"
                >
                  {item.title}
                </a>
              ) : (
                <span className="truncate">{item.title}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
