import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { sortModels } from "@/lib/llm/models";
import { ProbeSchema, type LlmModel } from "@/lib/llm/types";

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 1 });
}

/**
 * Modelos da Anthropic que servem para este produto.
 *
 * A API informa a capacidade, então o filtro é factual e nunca desatualiza: se
 * a Anthropic lançar um modelo novo com structured outputs, ele aparece sozinho
 * na lista; se aposentar um, ele some.
 *
 * `effort` vem junto porque é uma pegadinha separada — o Haiku 4.5 suporta
 * structured outputs mas **rejeita** o parâmetro `effort`. Mandar effort para
 * ele seria um 400 na hora de gerar o relatório.
 */
export async function listAnthropicModels(apiKey: string): Promise<LlmModel[]> {
  const modelos: LlmModel[] = [];

  for await (const modelo of client(apiKey).models.list({ limit: 100 })) {
    if (!modelo.capabilities?.structured_outputs?.supported) continue;

    modelos.push({
      id: modelo.id,
      displayName: modelo.display_name ?? modelo.id,
      supportsStructuredOutputs: true,
      supportsEffort: modelo.capabilities.effort?.supported ?? false,
    });
  }

  return sortModels(modelos);
}

/**
 * Confirma na prática que o modelo devolve saída estruturada.
 *
 * Redundante na Anthropic, já que a API declara a capacidade — mas manter a
 * mesma sonda nos dois provedores significa que a interface tem um caminho só,
 * e que a confirmação vale para o modelo específico e a chave específica, não
 * para o que a documentação diz.
 *
 * `thinking` e `effort` ficam de fora de propósito: `effort` dá erro no Haiku
 * 4.5, e `thinking: disabled` dá erro no Fable 5. Omitir os dois funciona em
 * todos. O `max_tokens` é folgado porque, quando o thinking adaptativo está
 * ligado por padrão, ele consome do mesmo orçamento da resposta.
 */
export async function probeAnthropic(
  apiKey: string,
  model: string,
): Promise<boolean> {
  const resposta = await client(apiKey).messages.parse({
    model,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(ProbeSchema) },
    messages: [
      { role: "user", content: "Responda com ok igual a true. Nada além disso." },
    ],
  });

  return resposta.parsed_output?.ok === true;
}
