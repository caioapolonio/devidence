import { z } from "zod";

export const LLM_PROVIDERS = ["anthropic", "openai"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

/** Onde a pessoa vai buscar a chave. */
export const PROVIDER_KEY_URLS: Record<LlmProvider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
};

export type LlmModel = {
  id: string;
  displayName: string;
  /**
   * `true` quando o provedor afirma o suporte, `null` quando não há como saber
   * pela API. A OpenAI não expõe capacidade nenhuma em `/v1/models`, então lá
   * é sempre `null` e quem decide é a sonda.
   */
  supportsStructuredOutputs: boolean | null;
  /**
   * Nem todo modelo aceita o parâmetro `effort` — no Haiku 4.5 ele dá erro,
   * apesar de o modelo suportar structured outputs. Só a Anthropic informa.
   */
  supportsEffort: boolean | null;
};

/**
 * Credenciais de LLM da sessão.
 *
 * Mesmo tratamento do token do GitHub: vivem no cookie cifrado e nunca são
 * gravadas em banco. `verifiedAt` registra quando a sonda confirmou que o
 * modelo devolve saída estruturada de verdade.
 */
export type LlmCredentials = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  verifiedAt: string;
};

/** Schema mínimo da sonda de capacidade. */
export const ProbeSchema = z.object({
  ok: z.boolean(),
});

export function isLlmProvider(value: unknown): value is LlmProvider {
  return (
    typeof value === "string" &&
    (LLM_PROVIDERS as readonly string[]).includes(value)
  );
}
