"use client";

import { useEffect, useMemo, useState } from "react";

import { filterRepositories, type Repository } from "@/lib/github/repos";
import { DEFAULT_PERIOD_DAYS, PERIOD_OPTIONS } from "@/lib/period";

type State =
  | { kind: "loading" }
  | { kind: "ready"; repositories: Repository[] }
  | { kind: "error"; message: string; expired: boolean };

export function RepoPicker() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Repository | null>(null);
  const [days, setDays] = useState<number>(DEFAULT_PERIOD_DAYS);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch("/api/repos");
        const data = await response.json();
        if (!active) return;

        if (!response.ok) {
          setState({
            kind: "error",
            message: data.error ?? "Could not load.",
            expired: response.status === 401,
          });
          return;
        }

        setState({ kind: "ready", repositories: data.repositories });
      } catch {
        if (!active) return;
        setState({
          kind: "error",
          message: "Could not reach the server.",
          expired: false,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () =>
      state.kind === "ready"
        ? filterRepositories(state.repositories, query)
        : [],
    [state, query],
  );

  if (state.kind === "loading") {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Loading your repositories…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
      >
        <p>{state.message}</p>
        {state.expired && (
          <a
            className="mt-2 inline-block underline underline-offset-2"
            href="/api/auth/login"
          >
            Sign in again
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label htmlFor="query" className="block text-sm font-medium">
          Project
        </label>
        <input
          id="query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your repositories"
          className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />

        <ul className="mt-3 max-h-72 divide-y divide-black/5 overflow-y-auto rounded-md border border-black/10 dark:divide-white/5 dark:border-white/10">
          {visible.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-black/50 dark:text-white/50">
              No repository found.
            </li>
          )}

          {visible.map((repository) => {
            const active = selected?.id === repository.id;
            return (
              <li key={repository.id}>
                <button
                  type="button"
                  onClick={() => setSelected(repository)}
                  aria-pressed={active}
                  className={`flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-black/[0.07] dark:bg-white/10"
                      : "hover:bg-black/[0.04] dark:hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{repository.fullName}</span>
                  {repository.isPrivate && (
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px] text-black/60 dark:bg-white/15 dark:text-white/60">
                      private
                    </span>
                  )}
                  {repository.isArchived && (
                    <span className="text-[11px] text-black/40 dark:text-white/40">
                      archived
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Period</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              aria-pressed={days === option}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                days === option
                  ? "border-black/40 bg-black/[0.07] dark:border-white/40 dark:bg-white/10"
                  : "border-black/15 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              {option} days
            </button>
          ))}
        </div>
      </fieldset>

      {/* The button is deliberately inert until report generation ships: it
          stays disabled so it never looks clickable while doing nothing. The
          real action and its loading state arrive with the generator. */}
      <button
        type="button"
        disabled
        className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white opacity-40 dark:bg-white dark:text-black"
      >
        Generate report
      </button>

      <p className="text-sm text-black/50 dark:text-white/50">
        {selected
          ? `Ready to report on ${selected.fullName} over the last ${days} days. Generation is the next step being built.`
          : "Pick a project to continue."}
      </p>
    </div>
  );
}
