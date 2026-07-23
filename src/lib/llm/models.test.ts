import { describe, expect, it } from "vitest";

import {
  describeCredentialError,
  isSelectableOpenAIModel,
  sortModels,
} from "@/lib/llm/models";
import type { LlmModel } from "@/lib/llm/types";

function erro(status: number, message = ""): unknown {
  return Object.assign(new Error(message), { status });
}

describe("isSelectableOpenAIModel", () => {
  it("mantém modelos de conversa", () => {
    for (const id of ["gpt-5", "gpt-5-nano", "gpt-4o", "o3-mini", "chatgpt-4o-latest"]) {
      expect(isSelectableOpenAIModel(id), id).toBe(true);
    }
  });

  it("descarta o que não conversa", () => {
    const descartados = [
      "text-embedding-3-large",
      "omni-moderation-latest",
      "whisper-1",
      "tts-1-hd",
      "dall-e-3",
      "gpt-image-1",
      "gpt-4o-realtime-preview",
      "gpt-4o-audio-preview",
      "gpt-4o-transcribe",
      "davinci-002",
      "babbage-002",
    ];
    for (const id of descartados) {
      expect(isSelectableOpenAIModel(id), id).toBe(false);
    }
  });

  // A regra é filtrar por exclusão justamente para isto: uma família nova que
  // eu nunca vi precisa aparecer, e a sonda decide se serve.
  it("deixa passar família desconhecida em vez de escondê-la", () => {
    expect(isSelectableOpenAIModel("gpt-7-turbo-2027")).toBe(true);
    expect(isSelectableOpenAIModel("modelo-que-ainda-nao-existe")).toBe(true);
  });

  it("ignora maiúsculas", () => {
    expect(isSelectableOpenAIModel("TEXT-EMBEDDING-3-SMALL")).toBe(false);
  });
});

describe("sortModels", () => {
  const modelo = (id: string): LlmModel => ({
    id,
    displayName: id,
    supportsStructuredOutputs: true,
    supportsEffort: null,
  });

  it("ordena de forma estável e previsível", () => {
    const ordenados = sortModels([modelo("gpt-5"), modelo("gpt-4o"), modelo("o3")]);
    expect(ordenados.map((m) => m.id)).toEqual(["gpt-4o", "gpt-5", "o3"]);
  });

  it("não altera o array recebido", () => {
    const original = [modelo("z"), modelo("a")];
    sortModels(original);
    expect(original[0].id).toBe("z");
  });
});

describe("describeCredentialError", () => {
  it("distingue chave inválida de falta de permissão", () => {
    expect(describeCredentialError(erro(401))).toBe("chave_invalida");
    expect(describeCredentialError(erro(403))).toBe("sem_permissao");
  });

  it("reconhece modelo inexistente e limite de uso", () => {
    expect(describeCredentialError(erro(404))).toBe("modelo_inexistente");
    expect(describeCredentialError(erro(429))).toBe("limite_atingido");
  });

  // Este é o caso que sustenta a garantia do produto: sem identificá-lo, um
  // modelo sem structured outputs viraria "erro desconhecido".
  it("identifica recusa de schema como falta de structured outputs", () => {
    const variantes = [
      "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model.",
      "output_config.format is not supported by this model",
      "This model does not support structured outputs",
      "Unsupported schema for strict mode",
    ];
    for (const mensagem of variantes) {
      expect(describeCredentialError(erro(400, mensagem)), mensagem).toBe(
        "sem_structured_outputs",
      );
    }
  });

  it("não confunde outro 400 com falta de structured outputs", () => {
    expect(describeCredentialError(erro(400, "unknown model id"))).toBe(
      "modelo_inexistente",
    );
  });

  it("cai em indisponível para falha de rede ou erro sem status", () => {
    expect(describeCredentialError(new Error("fetch failed"))).toBe("indisponivel");
    expect(describeCredentialError(erro(500))).toBe("indisponivel");
    expect(describeCredentialError(null)).toBe("indisponivel");
  });
});
