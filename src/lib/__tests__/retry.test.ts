import { afterEach, describe, expect, it, vi } from "vitest";
import { backoffDelay, fetchWithRetry, isRetryableStatus } from "@/lib/retry";

const noSleep = async () => {};

function stubFetch(responses: (Response | Error)[]) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("stub exhausted");
    return next;
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isRetryableStatus", () => {
  it("retries rate limits and server errors only", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("backoffDelay", () => {
  it("grows with each attempt and stays within the cap", () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const d = backoffDelay(attempt, 500, 8000);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(8000);
    }
    const early = backoffDelay(0, 500, 8000);
    const late = backoffDelay(4, 500, 8000);
    expect(late).toBeGreaterThan(early);
  });
});

describe("fetchWithRetry", () => {
  it("returns immediately on success without retrying", async () => {
    const { fn } = stubFetch([new Response("ok", { status: 200 })]);
    const res = await fetchWithRetry("https://example.test/a", {}, { sleep: noSleep });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable statuses", async () => {
    const { fn } = stubFetch([new Response("nope", { status: 403 })]);
    const res = await fetchWithRetry("https://example.test/b", {}, { sleep: noSleep });
    expect(res.status).toBe(403);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and succeeds on a later attempt", async () => {
    const { fn } = stubFetch([
      new Response("slow down", { status: 429 }),
      new Response("ok", { status: 200 }),
    ]);
    const res = await fetchWithRetry("https://example.test/c", {}, { sleep: noSleep });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured number of attempts and returns the last response", async () => {
    const { fn } = stubFetch([
      new Response("", { status: 500 }),
      new Response("", { status: 500 }),
      new Response("", { status: 500 }),
    ]);
    const res = await fetchWithRetry("https://example.test/d", {}, { attempts: 3, sleep: noSleep });
    expect(res.status).toBe(500);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("honours a Retry-After header", async () => {
    stubFetch([
      new Response("", { status: 429, headers: { "retry-after": "2" } }),
      new Response("ok", { status: 200 }),
    ]);
    const slept: number[] = [];
    await fetchWithRetry(
      "https://example.test/e",
      {},
      { sleep: async (ms) => void slept.push(ms) }
    );
    expect(slept).toEqual([2000]);
  });

  it("retries network errors and rethrows if every attempt fails", async () => {
    const { fn } = stubFetch([
      new Error("ECONNRESET"),
      new Error("ECONNRESET"),
      new Error("ECONNRESET"),
    ]);
    await expect(
      fetchWithRetry("https://example.test/f", {}, { attempts: 3, sleep: noSleep })
    ).rejects.toThrow("ECONNRESET");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
