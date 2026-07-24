import { describe, expect, it } from "vitest";
import { chunk, orderReports, syntheticErrorReport } from "@/lib/report/batch";
import type { PropertyReport, PropertySummary } from "@/lib/types";

function okReport(id: string): PropertyReport {
  return {
    propertyId: id,
    propertyName: `Site ${id}`,
    accountName: "Acct",
    currencyCode: "USD",
    timeZone: "UTC",
    status: "ok",
    hasRevenue: false,
    noData: false,
  };
}

describe("chunk", () => {
  it("splits into consecutive chunks of at most size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when smaller than size", () => {
    expect(chunk([1, 2, 3], 20)).toEqual([[1, 2, 3]]);
  });

  it("returns no chunks for an empty list", () => {
    expect(chunk([], 20)).toEqual([]);
  });

  it("never produces a zero-length step", () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("syntheticErrorReport", () => {
  it("is a retryable error carrying the summary's display name", () => {
    const summary: PropertySummary = {
      propertyId: "9",
      propertyName: "Memorial Stores Blog",
      accountId: "103",
      accountName: "Memorial Stores",
    };
    const r = syntheticErrorReport("9", summary);
    expect(r.status).toBe("error");
    expect(r.error?.retryable).toBe(true);
    expect(r.propertyName).toBe("Memorial Stores Blog");
    expect(r.accountName).toBe("Memorial Stores");
  });

  it("falls back to a generic name when no summary is known", () => {
    expect(syntheticErrorReport("42").propertyName).toBe("Site 42");
  });
});

describe("orderReports", () => {
  const summaries = new Map<string, PropertySummary>([
    ["b", { propertyId: "b", propertyName: "Bravo", accountId: "1", accountName: "A" }],
  ]);

  it("preserves the requested selection order", () => {
    const reports = [okReport("c"), okReport("a"), okReport("b")];
    const ordered = orderReports(["a", "b", "c"], reports, summaries);
    expect(ordered.map((p) => p.propertyId)).toEqual(["a", "b", "c"]);
  });

  it("fills sites from a dropped batch with a synthetic error, in place", () => {
    // "b" is missing (its batch failed) → synthesized error keeps the slot.
    const ordered = orderReports(["a", "b", "c"], [okReport("a"), okReport("c")], summaries);
    expect(ordered.map((p) => p.propertyId)).toEqual(["a", "b", "c"]);
    expect(ordered[1].status).toBe("error");
    expect(ordered[1].propertyName).toBe("Bravo");
    expect(ordered[0].status).toBe("ok");
  });

  it("covers every requested id even when nothing came back", () => {
    const ordered = orderReports(["x", "y"], [], new Map());
    expect(ordered).toHaveLength(2);
    expect(ordered.every((p) => p.status === "error")).toBe(true);
  });
});
