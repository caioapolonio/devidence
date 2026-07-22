import { describe, expect, it } from "vitest";

import {
  clampDays,
  DEFAULT_PERIOD_DAYS,
  formatPeriodLabel,
  lastDays,
  MAX_PERIOD_DAYS,
} from "@/lib/period";

// Meio do dia, para provar que a normalização ignora a hora.
const NOW = new Date("2026-07-22T15:42:31.123Z");

describe("clampDays", () => {
  it("mantém valores dentro do intervalo", () => {
    expect(clampDays(30)).toBe(30);
    expect(clampDays(1)).toBe(1);
    expect(clampDays(365)).toBe(365);
  });

  it("grampeia valores fora do intervalo em vez de rejeitar", () => {
    expect(clampDays(0)).toBe(1);
    expect(clampDays(-40)).toBe(1);
    expect(clampDays(5000)).toBe(MAX_PERIOD_DAYS);
  });

  it("cai no padrão quando o número não é utilizável", () => {
    expect(clampDays(Number.NaN)).toBe(DEFAULT_PERIOD_DAYS);
    expect(clampDays(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PERIOD_DAYS);
  });

  it("trunca frações", () => {
    expect(clampDays(30.9)).toBe(30);
  });
});

describe("lastDays", () => {
  it("inclui o dia de hoje inteiro", () => {
    const period = lastDays(1, NOW);
    expect(period.start.toISOString()).toBe("2026-07-22T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-22T23:59:59.999Z");
    expect(period.dayCount).toBe(1);
  });

  it("conta hoje como um dos dias pedidos", () => {
    // 30 dias = hoje + os 29 anteriores, não hoje + 30.
    const period = lastDays(30, NOW);
    expect(period.start.toISOString()).toBe("2026-06-23T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-22T23:59:59.999Z");
  });

  it("atravessa a virada de ano", () => {
    const period = lastDays(60, new Date("2026-01-15T08:00:00.000Z"));
    expect(period.start.toISOString()).toBe("2025-11-17T00:00:00.000Z");
    expect(period.dayCount).toBe(60);
  });

  it("nunca cobre mais que o máximo, mesmo se pedirem", () => {
    const period = lastDays(10_000, NOW);
    expect(period.dayCount).toBe(MAX_PERIOD_DAYS);

    const spanMs = period.end.getTime() - period.start.getTime();
    const spanDays = Math.round(spanMs / (24 * 60 * 60 * 1000));
    expect(spanDays).toBe(MAX_PERIOD_DAYS);
  });

  it("descarta a hora do momento informado", () => {
    const meioDia = lastDays(7, new Date("2026-07-22T12:00:00.000Z"));
    const quaseMeiaNoite = lastDays(7, new Date("2026-07-22T23:59:00.000Z"));
    expect(meioDia).toEqual(quaseMeiaNoite);
  });
});

describe("formatPeriodLabel", () => {
  it("usa UTC para não deslocar a data conforme o fuso da máquina", () => {
    expect(formatPeriodLabel(lastDays(30, NOW))).toBe("23/06/2026 a 22/07/2026");
  });
});
