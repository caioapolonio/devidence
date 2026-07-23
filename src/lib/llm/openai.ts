import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { isSelectableOpenAIModel, sortModels } from "@/lib/llm/models";
import { ProbeSchema, type LlmModel } from "@/lib/llm/types";

function client(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 1 });
}

/**
 * OpenAI models the key can see.
 *
 * Unlike Anthropic, OpenAI's `/v1/models` returns only `id`, `object`,
 * `created` and `owned_by`: no capability information at all. There is no way to
 * tell from here whether a model accepts structured outputs, so
 * `supportsStructuredOutputs` stays `null` and the decision moves entirely to
 * the probe.
 */
export async function listOpenAIModels(apiKey: string): Promise<LlmModel[]> {
  const models: LlmModel[] = [];

  for await (const model of client(apiKey).models.list()) {
    if (!isSelectableOpenAIModel(model.id)) continue;

    models.push({
      id: model.id,
      displayName: model.id,
      supportsStructuredOutputs: null,
      supportsEffort: null,
    });
  }

  return sortModels(models);
}

/**
 * The only way to know whether an OpenAI model accepts structured outputs.
 *
 * `max_completion_tokens` instead of `max_tokens`: the reasoning models reject
 * the older parameter. The budget is generous because those models spend
 * reasoning tokens before answering, and a tight cap would return a truncated
 * response, which would read as a lack of support.
 */
export async function probeOpenAI(
  apiKey: string,
  model: string,
): Promise<boolean> {
  const response = await client(apiKey).chat.completions.parse({
    model,
    max_completion_tokens: 2048,
    response_format: zodResponseFormat(ProbeSchema, "probe"),
    messages: [
      { role: "user", content: "Reply with ok set to true. Nothing else." },
    ],
  });

  return response.choices[0]?.message.parsed?.ok === true;
}
