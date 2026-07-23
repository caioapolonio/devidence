"use client";

import { useEffect, useState } from "react";

import {
  LLM_PROVIDERS,
  PROVIDER_KEY_URLS,
  PROVIDER_LABELS,
  type LlmModel,
  type LlmProvider,
} from "@/lib/llm/types";

type Credenciais = {
  provider: LlmProvider;
  model: string;
  verifiedAt: string;
};

export function LlmCredentialsForm() {
  const [credenciais, setCredenciais] = useState<Credenciais | null | undefined>(
    undefined,
  );
  const [provider, setProvider] = useState<LlmProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<LlmModel[] | null>(null);
  const [model, setModel] = useState("");
  const [ocupado, setOcupado] = useState<null | "listando" | "verificando">(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/llm/credentials")
      .then((r) => r.json())
      .then((d) => setCredenciais(d.credenciais ?? null))
      .catch(() => setCredenciais(null));
  }, []);

  async function buscarModelos() {
    setOcupado("listando");
    setErro(null);
    setModels(null);

    try {
      const resposta = await fetch("/api/llm/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível listar os modelos.");
        return;
      }

      setModels(dados.models);
      setModel(dados.models[0]?.id ?? "");
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setOcupado(null);
    }
  }

  async function verificarESalvar() {
    setOcupado("verificando");
    setErro(null);

    try {
      const resposta = await fetch("/api/llm/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível verificar o modelo.");
        return;
      }

      setCredenciais(dados.credenciais);
      // A chave sai da memória do componente assim que é selada na sessão.
      setApiKey("");
      setModels(null);
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setOcupado(null);
    }
  }

  async function remover() {
    await fetch("/api/llm/credentials", { method: "DELETE" });
    setCredenciais(null);
    setModels(null);
    setApiKey("");
  }

  if (credenciais === undefined) {
    return <p className="text-sm text-black/50 dark:text-white/50">Carregando…</p>;
  }

  if (credenciais) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-md border border-black/10 px-4 py-3 dark:border-white/10">
          <p className="text-sm">
            <span className="font-medium">
              {PROVIDER_LABELS[credenciais.provider]}
            </span>{" "}
            · <code className="text-[13px]">{credenciais.model}</code>
          </p>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Saída estruturada confirmada em{" "}
            {new Date(credenciais.verifiedAt).toLocaleString("pt-BR")}.
          </p>
        </div>

        <button
          type="button"
          onClick={remover}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/5"
        >
          Remover chave
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Provedor</legend>
        <div className="mt-2 flex gap-2">
          {LLM_PROVIDERS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => {
                setProvider(opcao);
                setModels(null);
                setErro(null);
              }}
              aria-pressed={provider === opcao}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                provider === opcao
                  ? "border-black/40 bg-black/[0.07] dark:border-white/40 dark:bg-white/10"
                  : "border-black/15 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              {PROVIDER_LABELS[opcao]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium">
          Chave de API
        </label>
        <input
          id="apiKey"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(evento) => setApiKey(evento.target.value)}
          placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
          className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
        <p className="mt-1.5 text-sm text-black/55 dark:text-white/55">
          Pegue a sua em{" "}
          <a
            className="underline underline-offset-2"
            href={PROVIDER_KEY_URLS[provider]}
            target="_blank"
            rel="noreferrer"
          >
            {PROVIDER_LABELS[provider]}
          </a>
          .
        </p>
      </div>

      {!models && (
        <button
          type="button"
          onClick={buscarModelos}
          disabled={!apiKey || ocupado !== null}
          className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {ocupado === "listando" ? "Buscando modelos…" : "Buscar modelos"}
        </button>
      )}

      {models && (
        <>
          <div>
            <label htmlFor="model" className="block text-sm font-medium">
              Modelo
            </label>
            <select
              id="model"
              value={model}
              onChange={(evento) => setModel(evento.target.value)}
              className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
            >
              {models.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.displayName}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-sm text-black/55 dark:text-white/55">
              {provider === "anthropic"
                ? "Só aparecem modelos que a API confirma que suportam saída estruturada."
                : "A OpenAI não informa capacidade dos modelos, então a lista é ampla. A verificação abaixo confirma o modelo escolhido com uma chamada mínima."}
            </p>
          </div>

          <button
            type="button"
            onClick={verificarESalvar}
            disabled={!model || ocupado !== null}
            className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {ocupado === "verificando" ? "Verificando…" : "Verificar e salvar"}
          </button>
        </>
      )}

      {erro && (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
