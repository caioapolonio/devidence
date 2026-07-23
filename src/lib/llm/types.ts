import { z } from "zod";

export const LLM_PROVIDERS = ["anthropic", "openai"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

/** Where the person goes to get their key. */
export const PROVIDER_KEY_URLS: Record<LlmProvider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
};

export type LlmModel = {
  id: string;
  displayName: string;
  /**
   * `true` when the provider asserts support, `null` when there is no way to
   * know from the API. OpenAI exposes no capability at all in `/v1/models`, so
   * there it is always `null` and the probe decides.
   */
  supportsStructuredOutputs: boolean | null;
  /**
   * Not every model accepts the `effort` parameter. On Haiku 4.5 it errors even
   * though the model supports structured outputs. Only Anthropic reports it.
   */
  supportsEffort: boolean | null;
};

/**
 * The session's LLM credentials.
 *
 * Same treatment as the GitHub token: they live in the encrypted cookie and are
 * never written to a database. `verifiedAt` records when the probe confirmed the
 * model really returns structured output.
 */
export type LlmCredentials = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  verifiedAt: string;
};

/** Minimal schema for the capability probe. */
export const ProbeSchema = z.object({
  ok: z.boolean(),
});

export function isLlmProvider(value: unknown): value is LlmProvider {
  return (
    typeof value === "string" &&
    (LLM_PROVIDERS as readonly string[]).includes(value)
  );
}
