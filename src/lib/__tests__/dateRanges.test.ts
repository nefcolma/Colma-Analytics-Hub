import { describe, expect, it } from "vitest";
import {
  compareRangeFor,
  isValidIsoDate,
  parseIso,
  previousPeriod,
  previousYear,
  rangeLengthDays,
  resolveRange,
  toIso,
} from "@/lib/dateRanges";

const TODAY = new Date(Date.UTC(2026, 6, 23)); // 2026-07-23

describe("toIso / parseIso", () => {
  it("round-trips a UTC date", () => {
    expect(toIso(parseIso("2024-02-29"))).toBe("2024-02-29");
  });

  it("formats single-digit months and days with padding", () => {
    expect(toIso(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });
});

describe("isValidIsoDate", () => {
  it("accepts well-formed dates", () => {
    expect(isValidIsoDate("2026-07-23")).toBe(true);
  });
  it("rejects malformed or impossible dates", () => {
    expect(isValidIsoDate("2026-7-23")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("resolveRange", () => {
  it("resolves today", () => {
    expect(resolveRange({ preset: "today" }, TODAY)).toEqual({
      startDate: "2026-07-23",
      endDate: "2026-07-23",
    });
  });

  it("resolves yesterday", () => {
    expect(resolveRange({ preset: "yesterday" }, TODAY)).toEqual({
      startDate: "2026-07-22",
      endDate: "2026-07-22",
    });
  });

  it("resolves last 7 days ending yesterday", () => {
    const r = resolveRange({ preset: "last7" }, TODAY);
    expect(r).toEqual({ startDate: "2026-07-16", endDate: "2026-07-22" });
    expect(rangeLengthDays(r)).toBe(7);
  });

  it("resolves last 30 days ending yesterday", () => {
    const r = resolveRange({ preset: "last30" }, TODAY);
    expect(r).toEqual({ startDate: "2026-06-23", endDate: "2026-07-22" });
    expect(rangeLengthDays(r)).toBe(30);
  });

  it("resolves this month to date", () => {
    expect(resolveRange({ preset: "thisMonth" }, TODAY)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-23",
    });
  });

  it("resolves last month in full", () => {
    expect(resolveRange({ preset: "lastMonth" }, TODAY)).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
  });

  it("uses explicit dates for custom ranges", () => {
    expect(
      resolveRange({ preset: "custom", start: "2026-01-01", end: "2026-01-31" }, TODAY)
    ).toEqual({ startDate: "2026-01-01", endDate: "2026-01-31" });
  });

  it("swaps reversed custom ranges", () => {
    expect(
      resolveRange({ preset: "custom", start: "2026-01-31", end: "2026-01-01" }, TODAY)
    ).toEqual({ startDate: "2026-01-01", endDate: "2026-01-31" });
  });
});

describe("previousPeriod", () => {
  it("returns the immediately preceding window of equal length", () => {
    expect(previousPeriod({ startDate: "2026-07-16", endDate: "2026-07-22" })).toEqual({
      startDate: "2026-07-09",
      endDate: "2026-07-15",
    });
  });

  it("handles a single day", () => {
    expect(previousPeriod({ startDate: "2026-07-23", endDate: "2026-07-23" })).toEqual({
      startDate: "2026-07-22",
      endDate: "2026-07-22",
    });
  });
});

describe("previousYear", () => {
  it("shifts the window back one year", () => {
    expect(previousYear({ startDate: "2026-07-16", endDate: "2026-07-22" })).toEqual({
      startDate: "2025-07-16",
      endDate: "2025-07-22",
    });
  });
});

describe("compareRangeFor", () => {
  const range = { startDate: "2026-07-16", endDate: "2026-07-22" };

  it("returns undefined when comparison is off", () => {
    expect(compareRangeFor(range, "none")).toBeUndefined();
  });

  it("dispatches to the right strategy", () => {
    expect(compareRangeFor(range, "previous_period")).toEqual(previousPeriod(range));
    expect(compareRangeFor(range, "previous_year")).toEqual(previousYear(range));
  });
});
