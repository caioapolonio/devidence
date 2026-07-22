/**
 * Espelha `SidebarDestination` do app macOS (GitManager/Domain/AppTypes.swift).
 * Os títulos são os mesmos do app nativo para que a migração não mude o
 * vocabulário que o usuário já conhece.
 */
export type Destination = {
  href: string;
  title: string;
};

export const destinations: Destination[] = [
  { href: "/", title: "Visão geral" },
  { href: "/atividade", title: "Atividade" },
  { href: "/relatorios", title: "Relatórios" },
  { href: "/configuracoes", title: "Configurações" },
];

/** Espelha `ActivityPerspective`. */
export const perspectives = {
  personal: "Minha contribuição",
  project: "Projeto inteiro",
  comparison: "Comparar ambos",
} as const;

export type Perspective = keyof typeof perspectives;

/** Espelha `SyncStatus`. */
export type SyncStatus = "idle" | "syncing" | "complete" | "partial" | "failed";

/** Limites herdados do app nativo; a web não os afrouxa. */
export const limits = {
  maxRepositories: 5,
  maxIntervalDays: 365,
} as const;
