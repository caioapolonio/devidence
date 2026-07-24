"use client";

import { useState } from "react";

import { ReportView, type UsedEvidence } from "@/components/ReportView";
import type { ReportDraft } from "@/lib/report/schema";
import { streamSSE } from "@/lib/sse";

type DoneData = {
  draft: ReportDraft;
  evidence: UsedEvidence[];
  coverageNote: string | null;
  excludedCount: number;
};

type Phase =
  | { kind: "idle" }
  | { kind: "running"; label: string }
  | { kind: "error"; message: string }
  | { kind: "done"; result: DoneData };

const PROGRESS_LABELS: Record<string, string> = {
  fetching: "Fetching activity from GitHub…",
  building: "Selecting and bounding the evidence…",
  generating: "Writing the report…",
};

export function ReportPanel({
  owner,
  repo,
  days,
}: {
  owner: string;
  repo: string;
  days: number;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function generate() {
    setPhase({ kind: "running", label: PROGRESS_LABELS.fetching });

    try {
      for await (const { event, data } of streamSSE("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, days }),
      })) {
        if (event === "progress") {
          const step = (data as { step: string; evidenceCount?: number }).step;
          const count = (data as { evidenceCount?: number }).evidenceCount;
          const base = PROGRESS_LABELS[step] ?? "Working…";
          setPhase({
            kind: "running",
            label: count ? `${base} (${count} evidence items)` : base,
          });
        } else if (event === "error") {
          setPhase({
            kind: "error",
            message: (data as { message: string }).message,
          });
        } else if (event === "done") {
          setPhase({ kind: "done", result: data as DoneData });
        }
      }
    } catch {
      setPhase({ kind: "error", message: "The connection dropped. Try again." });
    }
  }

  const running = phase.kind === "running";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={generate}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {running && (
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {running ? "Generating…" : "Generate report"}
      </button>

      {phase.kind === "running" && (
        <p className="text-sm text-black/55 dark:text-white/55">{phase.label}</p>
      )}

      {phase.kind === "error" && (
        <div
          role="alert"
          className="max-w-2xl rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {phase.message}
        </div>
      )}

      {phase.kind === "done" && (
        <ReportView
          draft={phase.result.draft}
          evidence={phase.result.evidence}
          coverageNote={phase.result.coverageNote}
          excludedCount={phase.result.excludedCount}
        />
      )}
    </div>
  );
}
