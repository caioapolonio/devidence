"use client";

import { useEffect, useState } from "react";

import { fetchHealth, type Health } from "@/lib/api";

/**
 * Equivale ao `startupWarning` do app nativo: ele avisava quando o banco local
 * não abria. Aqui o equivalente é o backend estar fora ou degradado — e o
 * aviso nomeia qual dependência caiu, porque "algo falhou" não ajuda ninguém
 * a consertar.
 */
export function HealthBanner() {
  const [health, setHealth] = useState<Health | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchHealth().then((result) => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (health === undefined || health?.status === "ok") return null;

  const message =
    health === null
      ? "O backend ainda não existe neste repositório. O front funciona, mas sem dados."
      : `Serviço degradado — banco: ${health.database}, fila: ${health.redis}.`;

  return (
    <div
      role="status"
      className="bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400"
    >
      {message}
    </div>
  );
}
