import { z } from "zod";

/**
 * The report the model must produce, as a schema it is constrained to.
 *
 * Ported from `ReportModels.swift`. The shape is deliberately the common
 * denominator of both providers' structured-output support: object, array,
 * string, and a string enum, with nothing (no `minLength`, no `minimum`, no
 * recursion) that OpenAI's strict mode rejects. Every field is required, which
 * strict mode also demands.
 *
 * Each claim carries the IDs of the evidence that backs it. That link is the
 * whole point: the validator later refuses any claim whose evidence is missing,
 * unknown, or of the wrong kind, so the model cannot state something the data
 * doesn't support.
 */

export const ReportClaimSchema = z.object({
  text: z.string(),
  classification: z.enum(["fact", "inference", "context"]),
  evidenceIds: z.array(z.string()),
});

export const ReportSectionSchema = z.object({
  title: z.string(),
  claims: z.array(ReportClaimSchema),
});

export const ReportDraftSchema = z.object({
  title: z.string(),
  periodLabel: z.string(),
  executiveSummary: z.array(ReportClaimSchema),
  executiveSections: z.array(ReportSectionSchema),
  technicalAppendix: z.array(ReportSectionSchema),
  caveats: z.array(z.string()),
});

export type ReportClaim = z.infer<typeof ReportClaimSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportDraft = z.infer<typeof ReportDraftSchema>;
