import type { LlmModel } from "@/lib/llm/types";

/**
 * A OpenAI devolve todos os modelos da conta em `/v1/models` — embeddings,
 * áudio, imagem, moderação — sem nenhuma informação de capacidade. Como não há
 * o que consultar, sobra filtrar por nome.
 *
 * O filtro é por **exclusão**, não por inclusão: uma lista de prefixos
 * permitidos ficaria desatualizada a cada família nova de modelo e esconderia
 * do usuário justamente o modelo mais recente. Excluindo o que sabidamente não
 * conversa, um modelo novo aparece por padrão — e se não servir, a sonda barra
 * com mensagem clara.
 */
const NAO_CONVERSACIONAIS = [
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
  const normalizado = id.toLowerCase();
  return !NAO_CONVERSACIONAIS.some((marcador) =>
    normalizado.includes(marcador),
  );
}

/**
 * Mais novos primeiro quando há data; alfabético como desempate. Modelo novo
 * costuma ser o que a pessoa quer, e ficar caçando na lista é atrito à toa.
 */
export function sortModels(models: LlmModel[]): LlmModel[] {
  return [...models].sort((a, b) => a.id.localeCompare(b.id));
}

/** Mensagens de erro que a tela sabe explicar. */
export type CredentialFailure =
  | "chave_invalida"
  | "sem_permissao"
  | "modelo_inexistente"
  | "limite_atingido"
  | "sem_structured_outputs"
  | "indisponivel";

export const CREDENTIAL_MESSAGES: Record<CredentialFailure, string> = {
  chave_invalida: "A chave não foi aceita pelo provedor. Confira se copiou inteira.",
  sem_permissao: "A chave não tem permissão para usar este modelo.",
  modelo_inexistente: "Este modelo não existe ou não está liberado para a sua conta.",
  limite_atingido: "Sua conta no provedor atingiu o limite de uso.",
  sem_structured_outputs:
    "Este modelo não devolve saída estruturada, então não dá para garantir que cada afirmação do relatório tenha evidência. Escolha outro modelo.",
  indisponivel: "Não foi possível falar com o provedor agora.",
};

/**
 * Traduz erro de SDK para um motivo que a interface explica.
 *
 * O caso que mais importa é o 400 de schema: sem distingui-lo, um modelo sem
 * structured outputs viraria "erro desconhecido" e a pessoa ficaria tentando de
 * novo sem entender. A garantia do produto depende dessa mensagem ser precisa.
 */
export function describeCredentialError(error: unknown): CredentialFailure {
  const status = extrairStatus(error);
  const mensagem = extrairMensagem(error).toLowerCase();

  if (status === 401) return "chave_invalida";
  if (status === 403) return "sem_permissao";
  if (status === 404) return "modelo_inexistente";
  if (status === 429) return "limite_atingido";

  if (status === 400) {
    const pistasDeSchema = [
      "json_schema",
      "response_format",
      "output_config",
      "structured output",
      "structured_outputs",
      "schema",
    ];
    if (pistasDeSchema.some((pista) => mensagem.includes(pista))) {
      return "sem_structured_outputs";
    }
    return "modelo_inexistente";
  }

  return "indisponivel";
}

function extrairStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

function extrairMensagem(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}
