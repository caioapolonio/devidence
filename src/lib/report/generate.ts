import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import {
  CREDENTIAL_MESSAGES,
  describeCredentialError,
  type CredentialFailure,
} from "@/lib/llm/models";
import type { LlmProvider } from "@/lib/llm/types";
import type { EvidencePayload } from "@/lib/report/builder";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/report/prompt";
import { ReportDraftSchema, type ReportDraft } from "@/lib/report/schema";
import { validateReport, type ValidationIssue } from "@/lib/report/validator";

export type GenerateResult =
  | { ok: true; draft: ReportDraft }
  | {
      ok: false;
      reason: CredentialFailure | "validation_failed" | "empty_response";
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * The two adapters differ only in how each SDK receives the same Zod schema.
 * `max_tokens` is generous because adaptive thinking, on by default, draws from
 * the same budget as the answer; a tight cap would truncate the report.
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  user: string,
): Promise<ReportDraft | null> {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(ReportDraftSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: user }],
  });
  return response.parsed_output ?? null;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  user: string,
): Promise<ReportDraft | null> {
  const client = new OpenAI({ apiKey, maxRetries: 1 });
  const response = await client.chat.completions.parse({
    model,
    max_completion_tokens: 16000,
    response_format: zodResponseFormat(ReportDraftSchema, "report"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
  });
  return response.choices[0]?.message.parsed ?? null;
}

/**
 * Generates the report and refuses to return one that doesn't pass validation.
 *
 * The order is the point: the model answers, then the validator checks every
 * claim against the evidence, and a draft that cites anything it shouldn't is
 * blocked rather than handed back. A credit or key error is named specifically,
 * reusing the same mapping the settings page uses, so "out of credits" reads as
 * that and not as a generic failure.
 */
export async function generateReport(args: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  payload: EvidencePayload;
  periodLabel: string;
}): Promise<GenerateResult> {
  const user = buildUserMessage({
    repository: args.payload.repository,
    periodLabel: args.periodLabel,
    evidence: args.payload.evidence,
    coverageNote: args.payload.coverageNote,
  });

  let draft: ReportDraft | null;
  try {
    draft =
      args.provider === "anthropic"
        ? await callAnthropic(args.apiKey, args.model, user)
        : await callOpenAI(args.apiKey, args.model, user);
  } catch (error) {
    const reason = describeCredentialError(error);
    return { ok: false, reason, message: CREDENTIAL_MESSAGES[reason] };
  }

  if (!draft) {
    return {
      ok: false,
      reason: "empty_response",
      message: "The model returned an empty response. Try again.",
    };
  }

  const issues = validateReport(draft, args.payload.evidence);
  if (issues.length > 0) {
    return {
      ok: false,
      reason: "validation_failed",
      message:
        "The generated report made claims that weren't backed by the evidence, so it was blocked. This is the safeguard working. Try generating again.",
      issues,
    };
  }

  return { ok: true, draft };
}
