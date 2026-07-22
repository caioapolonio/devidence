"use client";

import { useEffect, useMemo, useState } from "react";

import { filterRepositories, type Repository } from "@/lib/github/repos";
import { DEFAULT_PERIOD_DAYS, PERIOD_OPTIONS } from "@/lib/period";

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pronto"; repositories: Repository[] }
  | { tipo: "erro"; mensagem: string; expirou: boolean };

export function RepoPicker() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Repository | null>(null);
  const [dias, setDias] = useState<number>(DEFAULT_PERIOD_DAYS);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const resposta = await fetch("/api/repos");
        const dados = await resposta.json();
        if (!ativo) return;

        if (!resposta.ok) {
          setEstado({
            tipo: "erro",
            mensagem: dados.erro ?? "Não foi possível carregar.",
            expirou: resposta.status === 401,
          });
          return;
        }

        setEstado({ tipo: "pronto", repositories: dados.repositories });
      } catch {
        if (!ativo) return;
        setEstado({
          tipo: "erro",
          mensagem: "Não foi possível falar com o servidor.",
          expirou: false,
        });
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const visiveis = useMemo(
    () =>
      estado.tipo === "pronto"
        ? filterRepositories(estado.repositories, busca)
        : [],
    [estado, busca],
  );

  if (estado.tipo === "carregando") {
    return <p className="text-sm text-black/50 dark:text-white/50">Carregando seus repositórios…</p>;
  }

  if (estado.tipo === "erro") {
    return (
      <div
        role="alert"
        className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
      >
        <p>{estado.mensagem}</p>
        {estado.expirou && (
          <a className="mt-2 inline-block underline underline-offset-2" href="/api/auth/login">
            Entrar de novo
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label htmlFor="busca" className="block text-sm font-medium">
          Projeto
        </label>
        <input
          id="busca"
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar entre os seus repositórios"
          className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />

        <ul className="mt-3 max-h-72 divide-y divide-black/5 overflow-y-auto rounded-md border border-black/10 dark:divide-white/5 dark:border-white/10">
          {visiveis.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-black/50 dark:text-white/50">
              Nenhum repositório encontrado.
            </li>
          )}

          {visiveis.map((repository) => {
            const ativo = selecionado?.id === repository.id;
            return (
              <li key={repository.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(repository)}
                  aria-pressed={ativo}
                  className={`flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    ativo
                      ? "bg-black/[0.07] dark:bg-white/10"
                      : "hover:bg-black/[0.04] dark:hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{repository.fullName}</span>
                  {repository.isPrivate && (
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px] text-black/60 dark:bg-white/15 dark:text-white/60">
                      privado
                    </span>
                  )}
                  {repository.isArchived && (
                    <span className="text-[11px] text-black/40 dark:text-white/40">
                      arquivado
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Período</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setDias(opcao)}
              aria-pressed={dias === opcao}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                dias === opcao
                  ? "border-black/40 bg-black/[0.07] dark:border-white/40 dark:bg-white/10"
                  : "border-black/15 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              {opcao} dias
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!selecionado}
        className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
      >
        Gerar relatório
      </button>

      {/* A geração chega na próxima entrega; o botão fica visível para o fluxo
          ficar legível, mas desabilitado enquanto não faz nada de verdade. */}
      <p className="text-sm text-black/50 dark:text-white/50">
        {selecionado
          ? `Pronto para relatar ${selecionado.fullName} nos últimos ${dias} dias. A geração chega na próxima entrega.`
          : "Escolha um projeto para continuar."}
      </p>
    </div>
  );
}
