import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { globalCache, TtlCache } from "@/lib/cache";

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
