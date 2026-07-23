import { describe, expect, it } from "vitest";

import {
  clampDays,
  DEFAULT_PERIOD_DAYS,
  formatPeriodLabel,
  lastDays,
  MAX_PERIOD_DAYS,
} from "@/lib/period";

// Midday, to prove that normalization ignores the time of day.
const NOW = new Date("2026-07-22T15:42:31.123Z");

describe("clampDays", () => {
  it("keeps values within range", () => {
    expect(clampDays(30)).toBe(30);
    expect(clampDays(1)).toBe(1);
    expect(clampDays(365)).toBe(365);
  });

  it("clamps out-of-range values instead of rejecting them", () => {
    expect(clampDays(0)).toBe(1);
    expect(clampDays(-40)).toBe(1);
    expect(clampDays(5000)).toBe(MAX_PERIOD_DAYS);
  });

  it("falls back to the default when the number is not usable", () => {
    expect(clampDays(Number.NaN)).toBe(DEFAULT_PERIOD_DAYS);
    expect(clampDays(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PERIOD_DAYS);
  });

  it("truncates fractions", () => {
    expect(clampDays(30.9)).toBe(30);
  });
});

describe("lastDays", () => {
  it("includes the whole of today", () => {
    const period = lastDays(1, NOW);
    expect(period.start.toISOString()).toBe("2026-07-22T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-22T23:59:59.999Z");
    expect(period.dayCount).toBe(1);
  });

  it("counts today as one of the requested days", () => {
    // 30 days = today plus the preceding 29, not today plus 30.
    const period = lastDays(30, NOW);
    expect(period.start.toISOString()).toBe("2026-06-23T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-22T23:59:59.999Z");
  });

  it("crosses the year boundary", () => {
    const period = lastDays(60, new Date("2026-01-15T08:00:00.000Z"));
    expect(period.start.toISOString()).toBe("2025-11-17T00:00:00.000Z");
    expect(period.dayCount).toBe(60);
  });

  it("never covers more than the maximum, even when asked", () => {
    const period = lastDays(10_000, NOW);
    expect(period.dayCount).toBe(MAX_PERIOD_DAYS);

    const spanMs = period.end.getTime() - period.start.getTime();
    const spanDays = Math.round(spanMs / (24 * 60 * 60 * 1000));
    expect(spanDays).toBe(MAX_PERIOD_DAYS);
  });

  it("discards the time of day of the given moment", () => {
    const midday = lastDays(7, new Date("2026-07-22T12:00:00.000Z"));
    const nearMidnight = lastDays(7, new Date("2026-07-22T23:59:00.000Z"));
    expect(midday).toEqual(nearMidnight);
  });
});

describe("formatPeriodLabel", () => {
  it("uses UTC so the date doesn't shift with the machine's timezone", () => {
    expect(formatPeriodLabel(lastDays(30, NOW))).toBe("6/23/2026 to 7/22/2026");
  });
});
