import { listAnthropicModels, probeAnthropic } from "@/lib/llm/anthropic";
import { listOpenAIModels, probeOpenAI } from "@/lib/llm/openai";
import type { LlmModel, LlmProvider } from "@/lib/llm/types";

/**
 * Single dispatch point per provider.
 *
 * The rest of the app talks to these two functions and does not know which SDK
 * sits underneath. When report generation arrives, it plugs in here the same
 * way.
 */

export async function listModels(
  provider: LlmProvider,
  apiKey: string,
): Promise<LlmModel[]> {
  return provider === "anthropic"
    ? listAnthropicModels(apiKey)
    : listOpenAIModels(apiKey);
}

export async function probeStructuredOutputs(
  provider: LlmProvider,
  apiKey: string,
  model: string,
): Promise<boolean> {
  return provider === "anthropic"
    ? probeAnthropic(apiKey, model)
    : probeOpenAI(apiKey, model);
}
