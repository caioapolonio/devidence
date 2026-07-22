/**
 * Janela de tempo do relatório.
 *
 * Porta `DateIntervalSelection` do app macOS: o intervalo é sempre de 1 a 365
 * dias, e valores fora disso são grampeados em vez de rejeitados — pedir 0 ou
 * 5.000 dias é erro de chamada, não motivo para quebrar a geração.
 *
 * As fronteiras são calculadas em UTC. O GitHub devolve todos os timestamps em
 * UTC, então alinhar aqui evita um dia de diferença entre o que o usuário pediu
 * e o que a API filtrou. O rótulo exibido na interface deve deixar isso claro.
 */
export const MAX_PERIOD_DAYS = 365;
export const MIN_PERIOD_DAYS = 1;

/** Opções oferecidas na interface. */
export const PERIOD_OPTIONS = [7, 30, 90, 180, 365] as const;

export const DEFAULT_PERIOD_DAYS = 30;

export type Period = {
  /** Início do primeiro dia da janela, 00:00:00.000 UTC. */
  start: Date;
  /** Fim do último dia da janela, 23:59:59.999 UTC. */
  end: Date;
  /** Quantidade de dias efetivamente coberta, já grampeada. */
  dayCount: number;
};

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_PERIOD_DAYS;
  return Math.min(Math.max(Math.trunc(days), MIN_PERIOD_DAYS), MAX_PERIOD_DAYS);
}

function startOfUTCDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Janela dos últimos `days` dias, incluindo o dia de hoje.
 *
 * `lastDays(1)` cobre apenas hoje; `lastDays(30)` cobre hoje e os 29 dias
 * anteriores.
 */
export function lastDays(days: number, now: Date = new Date()): Period {
  const dayCount = clampDays(days);
  const end = startOfUTCDay(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (dayCount - 1));

  return {
    start,
    end: new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1),
    dayCount,
  };
}

/** Rótulo do período para a capa do relatório. */
export function formatPeriodLabel(period: Period): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
  return `${formatter.format(period.start)} a ${formatter.format(period.end)}`;
}
