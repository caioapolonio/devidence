import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { isSelectableOpenAIModel, sortModels } from "@/lib/llm/models";
import { ProbeSchema, type LlmModel } from "@/lib/llm/types";

function client(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 1 });
}

/**
 * Modelos da OpenAI que a chave enxerga.
 *
 * Diferente da Anthropic, `/v1/models` da OpenAI devolve só `id`, `object`,
 * `created` e `owned_by` — nenhuma informação de capacidade. Não há como saber
 * daqui se o modelo aceita structured outputs, então `supportsStructuredOutputs`
 * fica `null` e a decisão passa inteiramente para a sonda.
 */
export async function listOpenAIModels(apiKey: string): Promise<LlmModel[]> {
  const modelos: LlmModel[] = [];

  for await (const modelo of client(apiKey).models.list()) {
    if (!isSelectableOpenAIModel(modelo.id)) continue;

    modelos.push({
      id: modelo.id,
      displayName: modelo.id,
      supportsStructuredOutputs: null,
      supportsEffort: null,
    });
  }

  return sortModels(modelos);
}

/**
 * Única forma de saber se um modelo da OpenAI aceita structured outputs.
 *
 * `max_completion_tokens` em vez de `max_tokens`: os modelos de raciocínio
 * recusam o parâmetro antigo. O orçamento é folgado porque esses modelos gastam
 * tokens de raciocínio antes de responder, e um teto apertado devolveria
 * resposta truncada — que seria lida como falta de suporte.
 */
export async function probeOpenAI(
  apiKey: string,
  model: string,
): Promise<boolean> {
  const resposta = await client(apiKey).chat.completions.parse({
    model,
    max_completion_tokens: 2048,
    response_format: zodResponseFormat(ProbeSchema, "sonda"),
    messages: [
      { role: "user", content: "Responda com ok igual a true. Nada além disso." },
    ],
  });

  return resposta.choices[0]?.message.parsed?.ok === true;
}
