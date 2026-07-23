"use client";

import { useEffect, useState } from "react";

import {
  LLM_PROVIDERS,
  PROVIDER_KEY_URLS,
  PROVIDER_LABELS,
  type LlmModel,
  type LlmProvider,
} from "@/lib/llm/types";

type Credentials = {
  provider: LlmProvider;
  model: string;
  verifiedAt: string;
};

export function LlmCredentialsForm() {
  const [credentials, setCredentials] = useState<Credentials | null | undefined>(
    undefined,
  );
  const [provider, setProvider] = useState<LlmProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<LlmModel[] | null>(null);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState<null | "listing" | "verifying">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/llm/credentials")
      .then((r) => r.json())
      .then((d) => setCredentials(d.credentials ?? null))
      .catch(() => setCredentials(null));
  }, []);

  /**
   * Switching provider clears the key and any listed models. A key for one
   * provider is useless on the other, and keeping it around only raises the
   * chance of sending the wrong one.
   */
  function switchProvider(next: LlmProvider) {
    setProvider(next);
    setApiKey("");
    setModels(null);
    setModel("");
    setError(null);
  }

  async function fetchModels() {
    setBusy("listing");
    setError(null);
    setModels(null);

    try {
      const response = await fetch("/api/llm/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not list the models.");
        return;
      }

      setModels(data.models);
      setModel(data.models[0]?.id ?? "");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyAndSave() {
    setBusy("verifying");
    setError(null);

    try {
      const response = await fetch("/api/llm/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not verify the model.");
        return;
      }

      setCredentials(data.credentials);
      // The key leaves the component's memory the moment it's sealed into the
      // session.
      setApiKey("");
      setModels(null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    await fetch("/api/llm/credentials", { method: "DELETE" });
    setCredentials(null);
    setModels(null);
    setApiKey("");
  }

  if (credentials === undefined) {
    return <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>;
  }

  if (credentials) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-md border border-black/10 px-4 py-3 dark:border-white/10">
          <p className="text-sm">
            <span className="font-medium">
              {PROVIDER_LABELS[credentials.provider]}
            </span>{" "}
            · <code className="text-[13px]">{credentials.model}</code>
          </p>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Structured output confirmed on{" "}
            {new Date(credentials.verifiedAt).toLocaleString("en-US")}.
          </p>
        </div>

        <button
          type="button"
          onClick={remove}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/5"
        >
          Remove key
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Provider</legend>
        <div className="mt-2 flex gap-2">
          {LLM_PROVIDERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchProvider(option)}
              aria-pressed={provider === option}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                provider === option
                  ? "border-black/40 bg-black/[0.07] dark:border-white/40 dark:bg-white/10"
                  : "border-black/15 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              {PROVIDER_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium">
          API key
        </label>
        <input
          id="apiKey"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
          className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
        <p className="mt-1.5 text-sm text-black/55 dark:text-white/55">
          Get yours at{" "}
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
          onClick={fetchModels}
          disabled={!apiKey || busy !== null}
          className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {busy === "listing" ? "Fetching models…" : "Fetch models"}
        </button>
      )}

      {models && (
        <>
          <div>
            <label htmlFor="model" className="block text-sm font-medium">
              Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
            >
              {models.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.displayName}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-sm text-black/55 dark:text-white/55">
              {provider === "anthropic"
                ? "Only models the API confirms support structured output are shown."
                : "OpenAI does not report model capabilities, so the list is broad. The check below confirms the chosen model with a minimal call."}
            </p>
          </div>

          <button
            type="button"
            onClick={verifyAndSave}
            disabled={!model || busy !== null}
            className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {busy === "verifying" ? "Verifying…" : "Verify and save"}
          </button>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
