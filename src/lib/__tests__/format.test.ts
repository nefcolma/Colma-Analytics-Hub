import { describe, expect, it } from "vitest";
import {
  fmtChange,
  fmtCompact,
  fmtCurrency,
  fmtDuration,
  fmtGaDate,
  fmtInt,
  fmtIsoDate,
  fmtRate,
  pctChange,
} from "@/lib/format";

describe("fmtInt / fmtCompact", () => {
  it("groups thousands and abbreviates large numbers", () => {
    expect(fmtInt(1234567)).toBe("1,234,567");
    expect(fmtCompact(1234567)).toMatch(/1\.2M/);
    expect(fmtCompact(950)).toBe("950");
  });

  it("renders missing values as a dash", () => {
    expect(fmtInt(undefined)).toBe("–");
    expect(fmtInt(null)).toBe("–");
    expect(fmtCompact(undefined)).toBe("–");
  });

  it("keeps zero as zero rather than a dash", () => {
    expect(fmtInt(0)).toBe("0");
  });
});

describe("fmtRate", () => {
  it("renders a proportion as a percentage", () => {
    expect(fmtRate(0.6123)).toBe("61.2%");
    expect(fmtRate(0)).toBe("0.0%");
    expect(fmtRate(undefined)).toBe("–");
  });
});

describe("fmtDuration", () => {
  it("formats seconds as minutes and seconds", () => {
    expect(fmtDuration(95)).toBe("1m 35s");
    expect(fmtDuration(45)).toBe("45s");
    expect(fmtDuration(3725)).toBe("1h 2m");
    expect(fmtDuration(0)).toBe("0s");
    expect(fmtDuration(undefined)).toBe("–");
  });
});

describe("fmtCurrency", () => {
  it("formats with the property currency", () => {
    expect(fmtCurrency(1500, "USD")).toMatch(/\$1,500/);
    expect(fmtCurrency(1500, "CAD")).toMatch(/1,500/);
  });

  it("falls back gracefully on an unknown currency code", () => {
    expect(fmtCurrency(1500, "ZZZ")).toContain("1,500");
  });

  it("renders missing values as a dash", () => {
    expect(fmtCurrency(undefined, "USD")).toBe("–");
  });
});

describe("pctChange / fmtChange", () => {
  it("computes relative change", () => {
    expect(pctChange(150, 100)).toBeCloseTo(0.5, 10);
    expect(pctChange(50, 100)).toBeCloseTo(-0.5, 10);
  });

  it("returns null when there is no baseline to compare against", () => {
    expect(pctChange(150, 0)).toBeNull();
    expect(pctChange(150, undefined)).toBeNull();
  });

  it("formats change with an explicit sign", () => {
    expect(fmtChange(0.5)).toBe("+50.0%");
    expect(fmtChange(-0.5)).toBe("-50.0%");
    expect(fmtChange(null)).toBe("–");
  });
});

describe("date formatting", () => {
  it("formats GA compact dates in UTC", () => {
    expect(fmtGaDate("20260701")).toBe("Jul 1");
    expect(fmtGaDate("not-a-date")).toBe("not-a-date");
  });

  it("formats ISO dates with the year", () => {
    expect(fmtIsoDate("2026-07-23")).toBe("Jul 23, 2026");
  });
});
