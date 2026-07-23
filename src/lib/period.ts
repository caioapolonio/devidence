/**
 * Report time window.
 *
 * Ports `DateIntervalSelection` from the macOS app: the interval is always
 * between 1 and 365 days, and out-of-range values are clamped rather than
 * rejected. Asking for 0 or 5,000 days is a caller bug, not a reason to break
 * generation.
 *
 * Boundaries are computed in UTC. GitHub returns every timestamp in UTC, so
 * aligning here avoids a one-day gap between what the user asked for and what
 * the API filtered. The label shown in the UI should make that explicit.
 */
export const MAX_PERIOD_DAYS = 365;
export const MIN_PERIOD_DAYS = 1;

/** Options offered in the UI. */
export const PERIOD_OPTIONS = [7, 30, 90, 180, 365] as const;

export const DEFAULT_PERIOD_DAYS = 30;

export type Period = {
  /** Start of the first day in the window, 00:00:00.000 UTC. */
  start: Date;
  /** End of the last day in the window, 23:59:59.999 UTC. */
  end: Date;
  /** Number of days actually covered, already clamped. */
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
 * Window of the last `days` days, including today.
 *
 * `lastDays(1)` covers only today; `lastDays(30)` covers today and the
 * preceding 29 days.
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

/** Period label for the report cover. */
export function formatPeriodLabel(period: Period): string {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" });
  return `${formatter.format(period.start)} to ${formatter.format(period.end)}`;
}
