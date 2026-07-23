import { listAnthropicModels, probeAnthropic } from "@/lib/llm/anthropic";
import { listOpenAIModels, probeOpenAI } from "@/lib/llm/openai";
import type { LlmModel, LlmProvider } from "@/lib/llm/types";

/**
 * Ponto único de despacho por provedor.
 *
 * Todo o resto do app fala com estas duas funções e não sabe qual SDK está por
 * baixo. Quando a geração do relatório chegar, ela entra aqui do mesmo jeito.
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
