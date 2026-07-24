import { createHash } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CompareMode, DateRange, PropertyReport } from "./types";

/** Simple in-memory TTL cache (per server instance). */

type Entry<T> = { value: T; expires: number };

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  constructor(private ttlMs: number, private maxEntries = 500) {}

  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/** Survive dev hot-reload by stashing caches on globalThis. */
export function globalCache<T>(name: string, ttlMs: number): TtlCache<T> {
  const g = globalThis as unknown as Record<string, TtlCache<T>>;
  const key = `__cache_${name}`;
  if (!g[key]) g[key] = new TtlCache<T>(ttlMs);
  return g[key];
}

/* -------------------------------------------------------------------------- *
 * Report cache — Cloudflare Workers KV in production, in-memory otherwise.
 *
 * The production target is Cloudflare Workers via OpenNext. There the KV
 * namespace `REPORT_CACHE_KV` is the report cache. Everywhere else (local
 * `next dev`, unit tests, or any runtime where the binding is missing) we fall
 * back to the in-memory TtlCache above so behaviour is identical offline.
 *
 * Only *normalized* Google Analytics report responses (PropertyReport) are ever
 * cached here. OAuth access/refresh tokens, client/session secrets, auth codes
 * and any other authentication material are NEVER written to KV — the caller
 * passes only the report object, and the cache key is a one-way hash so raw
 * user identifiers never appear in KV key names either.
 * -------------------------------------------------------------------------- */

/**
 * Bump this when the normalized report shape, the set of GA dimensions/metrics,
 * or the key layout changes. It prefixes every key so a new deploy transparently
 * ignores (and eventually expires) entries written under the old format —
 * requirement: cache-version invalidation without a manual KV purge.
 */
export const REPORT_CACHE_VERSION = "rc:v1";

/** Current report TTL: 5 minutes, matching the previous in-memory behaviour. */
export const REPORT_TTL_MS = 5 * 60 * 1000;

/** Cloudflare rejects an expirationTtl below 60 seconds. */
const KV_MIN_EXPIRATION_TTL_SECONDS = 60;

/** Minimal structural view of the KV surface we use — avoids a hard dependency
 *  on @cloudflare/workers-types so the code type-checks without it installed. */
type KvNamespaceLike = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

type CloudflareRuntime = {
  kv: KvNamespaceLike;
  /** Cloudflare's ctx.waitUntil, when available, for non-blocking writes. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

/**
 * Resolves the Cloudflare runtime (KV binding + waitUntil) if we are running on
 * Workers with the binding present. Returns null in local dev, unit tests, or
 * when the binding is unavailable — the caller then uses the in-memory fallback.
 *
 * `getCloudflareContext()` is imported statically so the OpenNext build bundles
 * it into the worker, but it only *throws* when called outside the Workers
 * request context (e.g. `next dev`, vitest, or `next build`). We catch that and
 * degrade quietly to the in-memory cache, so this module has no hard runtime
 * dependency on the Cloudflare platform.
 */
function getCloudflareRuntime(): CloudflareRuntime | null {
  try {
    const { env, ctx } = getCloudflareContext();
    const kv = (env as { REPORT_CACHE_KV?: unknown } | undefined)?.REPORT_CACHE_KV as
      | KvNamespaceLike
      | undefined;
    if (!kv || typeof kv.get !== "function") return null;
    const waitUntil =
      typeof ctx?.waitUntil === "function"
        ? (ctx.waitUntil.bind(ctx) as (p: Promise<unknown>) => void)
        : undefined;
    return { kv, waitUntil };
  } catch {
    return null;
  }
}

/** In-memory fallback store, shared across hot reloads. */
function fallbackStore(): TtlCache<PropertyReport> {
  return globalCache<PropertyReport>("propertyReport", REPORT_TTL_MS);
}

/**
 * Describes everything that can change a single-property report. Every field
 * here feeds the cache key, so any change produces a distinct entry. Fields the
 * current report engine does not vary (dimensions/metrics/filters/sort/paging)
 * are still included for forward-compatibility and captured by the version tag.
 */
export type ReportCacheKeyInput = {
  /** User / authorization identity (email or subject) — hashed, never stored raw. */
  userKey: string;
  /** GA4 account ID. */
  accountId?: string;
  /** GA4 property ID (a single report is per-property). */
  propertyId: string;
  /** Requested reporting window. */
  range: DateRange;
  /** Comparison period selection. */
  compare: CompareMode;
  /** GA dimensions requested (defaults are fixed by the engine). */
  dimensions?: string[];
  /** GA metrics requested (defaults are fixed by the engine). */
  metrics?: string[];
  /** Dimension/metric filters, if any. */
  filters?: unknown;
  /** Ordering applied to the report. */
  sort?: unknown;
  /** Pagination (offset/limit or page token). */
  pagination?: unknown;
};

/** Stable JSON: object keys sorted recursively so equal inputs hash identically. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",");
  return `{${body}}`;
}

/**
 * Deterministic, privacy-preserving cache key. The full identity (including the
 * user key) is folded into a SHA-256 digest so no raw user identifier is exposed
 * in KV key names. The version prefix allows format-level invalidation.
 */
export function reportCacheKey(input: ReportCacheKeyInput): string {
  const canonical = stableStringify({
    u: input.userKey,
    a: input.accountId ?? "",
    p: input.propertyId,
    s: input.range.startDate,
    e: input.range.endDate,
    c: input.compare,
    dim: input.dimensions ?? null,
    met: input.metrics ?? null,
    flt: input.filters ?? null,
    srt: input.sort ?? null,
    pag: input.pagination ?? null,
  });
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `${REPORT_CACHE_VERSION}:${digest}`;
}

/**
 * Reads a cached report. Never throws: a KV read failure, a missing binding, or
 * invalid/corrupt cached JSON all resolve to `null` so the caller regenerates
 * the report by calling Google Analytics normally.
 */
export async function readReportCache(key: string): Promise<PropertyReport | null> {
  const runtime = getCloudflareRuntime();
  if (!runtime) {
    return fallbackStore().get(key) ?? null;
  }
  try {
    const raw = await runtime.kv.get(key, "text");
    if (!raw) return null;
    return JSON.parse(raw) as PropertyReport;
  } catch {
    // KV read error or malformed JSON — treat as a cache miss.
    return null;
  }
}

/**
 * Writes a report to the cache. Never throws and never blocks correctness:
 *  - On Workers, the KV write is scheduled with waitUntil (non-blocking) so the
 *    response is not delayed; a failed write just means the next request misses.
 *  - Elsewhere, the value goes to the in-memory fallback.
 * KV is treated as eventually consistent — callers must not depend on a write
 * being immediately readable.
 */
export async function writeReportCache(key: string, value: PropertyReport): Promise<void> {
  const runtime = getCloudflareRuntime();
  if (!runtime) {
    fallbackStore().set(key, value);
    return;
  }
  const expirationTtl = Math.max(
    KV_MIN_EXPIRATION_TTL_SECONDS,
    Math.round(REPORT_TTL_MS / 1000)
  );
  const write = async () => {
    try {
      await runtime.kv.put(key, JSON.stringify(value), { expirationTtl });
    } catch {
      // Write failures are non-fatal; the report has already been returned.
    }
  };
  if (runtime.waitUntil) {
    runtime.waitUntil(write());
  } else {
    // Fire-and-forget; swallow rejections so an unhandled promise can't crash.
    void write();
  }
}
