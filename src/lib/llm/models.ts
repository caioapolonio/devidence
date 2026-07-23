import type { LlmModel } from "@/lib/llm/types";

/**
 * OpenAI returns every model on the account in `/v1/models` (embeddings, audio,
 * image, moderation) with no capability information whatsoever. With nothing to
 * query, filtering by name is all that's left.
 *
 * The filter works by exclusion, not inclusion: an allow-list of prefixes would
 * go stale with every new model family and would hide exactly the newest model
 * from the user. By excluding what is known not to converse, a new model shows
 * up by default, and if it doesn't work the probe rejects it with a clear
 * message.
 */
const NON_CONVERSATIONAL = [
  "embedding",
  "moderation",
  "whisper",
  "tts",
  "dall-e",
  "-image",
  "image-",
  "-audio",
  "-realtime",
  "-transcribe",
  "davinci",
  "babbage",
  "-search",
  "computer-use",
  "guard",
];

export function isSelectableOpenAIModel(id: string): boolean {
  const normalized = id.toLowerCase();
  return !NON_CONVERSATIONAL.some((marker) => normalized.includes(marker));
}

/**
 * Newest first when a date is present, alphabetical as a tiebreaker. A new model
 * tends to be the one the person wants, and hunting for it in the list is
 * needless friction.
 */
export function sortModels(models: LlmModel[]): LlmModel[] {
  return [...models].sort((a, b) => a.id.localeCompare(b.id));
}

/** Error messages the screen knows how to explain. */
export type CredentialFailure =
  | "invalid_key"
  | "no_permission"
  | "unknown_model"
  | "rate_limited"
  | "insufficient_credits"
  | "no_structured_outputs"
  | "unavailable";

export const CREDENTIAL_MESSAGES: Record<CredentialFailure, string> = {
  invalid_key: "The provider did not accept the key. Check that you copied all of it.",
  no_permission: "The key is not allowed to use this model.",
  unknown_model: "This model does not exist or is not enabled for your account.",
  rate_limited: "The provider is rate-limiting this key. Wait a moment and try again.",
  insufficient_credits:
    "This key has no credits, or billing is not set up. Add credits to your provider account and try again.",
  no_structured_outputs:
    "This model does not return structured output, so there is no way to guarantee that every claim in the report is backed by evidence. Pick another model.",
  unavailable: "Could not reach the provider right now.",
};

/**
 * Turns an SDK error into a reason the UI can explain.
 *
 * The case that matters most is running out of credits. Both providers report
 * it in a way that, taken at face value, points at the wrong problem:
 *
 *   - Anthropic: HTTP 402 (billing_error), or HTTP 400 when the balance is low.
 *     Without special handling the 400 reads as "unknown model" and the 402 as
 *     "unavailable".
 *   - OpenAI: HTTP 429 with type `insufficient_quota`, the same status as a
 *     real rate limit, so the error type is what tells them apart.
 *
 * The product's whole premise is honesty, so pointing at the wrong cause is the
 * worst kind of failure. Credit and billing signals are therefore checked
 * before the generic status codes.
 */
export function describeCredentialError(error: unknown): CredentialFailure {
  const status = extractStatus(error);
  const type = extractType(error).toLowerCase();
  const message = extractMessage(error).toLowerCase();

  // Credit / billing, checked first so OpenAI's 429 quota case isn't mistaken
  // for a temporary rate limit, and Anthropic's 400/402 isn't mistaken for a
  // bad model.
  const billingTypes = ["insufficient_quota", "billing_error"];
  const billingHints = [
    "credit balance",
    "billing",
    "insufficient_quota",
    "insufficient credits",
    "purchase credits",
    "payment method",
  ];
  if (status === 402) return "insufficient_credits";
  if (billingTypes.some((t) => type.includes(t))) return "insufficient_credits";
  if (billingHints.some((h) => message.includes(h))) return "insufficient_credits";

  if (status === 401) return "invalid_key";
  if (status === 403) return "no_permission";
  if (status === 404) return "unknown_model";
  if (status === 429) return "rate_limited";

  if (status === 400) {
    const schemaHints = [
      "json_schema",
      "response_format",
      "output_config",
      "structured output",
      "structured_outputs",
      "schema",
    ];
    if (schemaHints.some((hint) => message.includes(hint))) {
      return "no_structured_outputs";
    }
    return "unknown_model";
  }

  return "unavailable";
}

function extractStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

/**
 * The error type/code, looked up across the shapes both SDKs use. OpenAI puts it
 * on `.code` and `.type`; Anthropic nests it under `.error.type`.
 */
function extractType(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const e = error as Record<string, unknown>;

  if (typeof e.type === "string") return e.type;
  if (typeof e.code === "string") return e.code;

  const nested = e.error;
  if (typeof nested === "object" && nested !== null) {
    const inner = nested as Record<string, unknown>;
    if (typeof inner.type === "string") return inner.type;
    if (typeof inner.code === "string") return inner.code;
  }

  return "";
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}
