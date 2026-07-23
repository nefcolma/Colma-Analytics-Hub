import { describe, expect, it } from "vitest";
import { createLimiter, mapWithLimit } from "@/lib/concurrency";

const tick = () => new Promise((r) => setTimeout(r, 1));

describe("mapWithLimit", () => {
  it("preserves input order regardless of completion order", async () => {
    const out = await mapWithLimit([30, 10, 20, 0], 2, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20, 0]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithLimit(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBe(3);
  });

  it("passes the index to the mapper", async () => {
    const out = await mapWithLimit(["a", "b", "c"], 2, async (item, i) => `${i}:${item}`);
    expect(out).toEqual(["0:a", "1:b", "2:c"]);
  });

  it("handles an empty list", async () => {
    expect(await mapWithLimit([], 3, async () => 1)).toEqual([]);
  });

  it("rejects if a task rejects", async () => {
    await expect(
      mapWithLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });
});

describe("createLimiter", () => {
  it("drains the queue after a rejection so later tasks still run", async () => {
    const limit = createLimiter(1);
    const failed = limit(async () => {
      throw new Error("first fails");
    });
    const succeeded = limit(async () => "second runs");
    await expect(failed).rejects.toThrow("first fails");
    await expect(succeeded).resolves.toBe("second runs");
  });
});
