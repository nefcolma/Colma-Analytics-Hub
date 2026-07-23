/** Fetch with exponential backoff for 429 and 5xx responses. */

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Injectable for tests */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function backoffDelay(attempt: number, base = 500, max = 8000): number {
  const exp = Math.min(max, base * 2 ** attempt);
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  opts: RetryOptions = {}
): Promise<Response> {
  const attempts = opts.attempts ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(input, init);
      if (!isRetryableStatus(res.status) || attempt === attempts - 1) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      await sleep(delay);
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1) throw err;
      await sleep(backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs));
    }
  }
  throw lastError ?? new Error("fetchWithRetry: exhausted attempts");
}
