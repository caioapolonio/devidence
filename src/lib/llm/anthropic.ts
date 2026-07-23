import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { sortModels } from "@/lib/llm/models";
import { ProbeSchema, type LlmModel } from "@/lib/llm/types";

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 1 });
}

/**
 * Anthropic models that work for this product.
 *
 * The API reports capability, so the filter is factual and never goes stale: if
 * Anthropic ships a new model with structured outputs, it shows up on its own;
 * if it retires one, it disappears.
 *
 * `effort` comes along because it's a separate gotcha: Haiku 4.5 supports
 * structured outputs but rejects the `effort` parameter. Sending effort to it
 * would be a 400 at report-generation time.
 */
export async function listAnthropicModels(apiKey: string): Promise<LlmModel[]> {
  const models: LlmModel[] = [];

  for await (const model of client(apiKey).models.list({ limit: 100 })) {
    if (!model.capabilities?.structured_outputs?.supported) continue;

    models.push({
      id: model.id,
      displayName: model.display_name ?? model.id,
      supportsStructuredOutputs: true,
      supportsEffort: model.capabilities.effort?.supported ?? false,
    });
  }

  return sortModels(models);
}

/**
 * Confirms in practice that the model returns structured output.
 *
 * Redundant on Anthropic, since the API declares the capability, but keeping the
 * same probe across both providers means the UI has a single path, and that the
 * confirmation is about this specific model and this specific key, not about
 * what the docs say.
 *
 * `thinking` and `effort` are left out on purpose: `effort` errors on Haiku 4.5,
 * and `thinking: disabled` errors on Fable 5. Omitting both works everywhere.
 * `max_tokens` is generous because, when adaptive thinking is on by default, it
 * draws from the same budget as the response.
 */
export async function probeAnthropic(
  apiKey: string,
  model: string,
): Promise<boolean> {
  const response = await client(apiKey).messages.parse({
    model,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(ProbeSchema) },
    messages: [
      { role: "user", content: "Reply with ok set to true. Nothing else." },
    ],
  });

  return response.parsed_output?.ok === true;
}
