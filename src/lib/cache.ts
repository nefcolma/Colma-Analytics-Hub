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
