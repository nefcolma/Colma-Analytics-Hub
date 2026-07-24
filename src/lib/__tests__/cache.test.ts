import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  globalCache,
  readReportCache,
  REPORT_CACHE_VERSION,
  reportCacheKey,
  TtlCache,
  writeReportCache,
  type ReportCacheKeyInput,
} from "@/lib/cache";
import type { PropertyReport } from "@/lib/types";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and returns a value within its TTL", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
  });

  it("expires entries once the TTL passes", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeUndefined();
  });

  it("returns undefined for unknown keys", () => {
    expect(new TtlCache<string>(1000).get("nope")).toBeUndefined();
  });

  it("overwrites an existing key and restarts its TTL", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("k", 1);
    vi.advanceTimersByTime(900);
    cache.set("k", 2);
    vi.advanceTimersByTime(500);
    expect(cache.get("k")).toBe(2);
  });

  it("deletes and clears entries on demand", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    cache.clear();
    expect(cache.get("b")).toBeUndefined();
  });

  it("evicts the oldest entry when the cache is full", () => {
    const cache = new TtlCache<number>(10_000, 3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("d")).toBe(4);
  });

  it("keeps caches with different TTLs independent", () => {
    const short = new TtlCache<string>(500);
    const long = new TtlCache<string>(5000);
    short.set("k", "a");
    long.set("k", "b");
    vi.advanceTimersByTime(1000);
    expect(short.get("k")).toBeUndefined();
    expect(long.get("k")).toBe("b");
  });
});

describe("globalCache", () => {
  it("returns the same instance for a given name", () => {
    expect(globalCache("test-scope", 1000)).toBe(globalCache("test-scope", 1000));
  });

  it("keeps distinct names separate", () => {
    const a = globalCache<string>("scope-a", 1000);
    const b = globalCache<string>("scope-b", 1000);
    a.set("k", "from-a");
    expect(b.get("k")).toBeUndefined();
  });
});

const baseKeyInput: ReportCacheKeyInput = {
  userKey: "analyst@example.com",
  accountId: "123",
  propertyId: "301442718",
  range: { startDate: "2026-07-01", endDate: "2026-07-23" },
  compare: "previous_period",
};

function sampleReport(propertyId = "301442718"): PropertyReport {
  return {
    propertyId,
    propertyName: "Colma Main Site",
    accountName: "Colma",
    currencyCode: "USD",
    timeZone: "America/Los_Angeles",
    status: "ok",
    hasRevenue: false,
    noData: false,
  };
}

describe("reportCacheKey", () => {
  it("is deterministic for identical inputs", () => {
    expect(reportCacheKey(baseKeyInput)).toBe(reportCacheKey({ ...baseKeyInput }));
  });

  it("carries the version prefix so formats can be invalidated", () => {
    expect(reportCacheKey(baseKeyInput).startsWith(`${REPORT_CACHE_VERSION}:`)).toBe(true);
  });

  it("never exposes the raw user identifier in the key", () => {
    expect(reportCacheKey(baseKeyInput)).not.toContain("analyst@example.com");
  });

  it("changes when any report-affecting field changes", () => {
    const base = reportCacheKey(baseKeyInput);
    const variants: ReportCacheKeyInput[] = [
      { ...baseKeyInput, userKey: "other@example.com" },
      { ...baseKeyInput, accountId: "999" },
      { ...baseKeyInput, propertyId: "555" },
      { ...baseKeyInput, range: { startDate: "2026-06-01", endDate: "2026-07-23" } },
      { ...baseKeyInput, compare: "none" },
      { ...baseKeyInput, dimensions: ["country"] },
      { ...baseKeyInput, metrics: ["sessions"] },
      { ...baseKeyInput, filters: { country: "US" } },
      { ...baseKeyInput, sort: [{ metric: "sessions", desc: true }] },
      { ...baseKeyInput, pagination: { offset: 10, limit: 10 } },
    ];
    for (const v of variants) expect(reportCacheKey(v)).not.toBe(base);
  });

  it("is insensitive to object key ordering in structured fields", () => {
    const a = reportCacheKey({ ...baseKeyInput, filters: { a: 1, b: 2 } });
    const b = reportCacheKey({ ...baseKeyInput, filters: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });
});

describe("report cache (in-memory fallback)", () => {
  it("round-trips a report through write/read when KV is unavailable", async () => {
    const key = reportCacheKey({ ...baseKeyInput, propertyId: "roundtrip-1" });
    expect(await readReportCache(key)).toBeNull();
    await writeReportCache(key, sampleReport("roundtrip-1"));
    const got = await readReportCache(key);
    expect(got?.propertyId).toBe("roundtrip-1");
  });

  it("returns null for an unknown key", async () => {
    const key = reportCacheKey({ ...baseKeyInput, propertyId: "never-written" });
    expect(await readReportCache(key)).toBeNull();
  });
});
