import { describe, expect, it } from "vitest";
import { DEMO_PROPERTIES, demoFixture, demoPropertiesResponse } from "@/lib/demo/fixtures";
import { demoPropertyReport, demoReport } from "@/lib/demo/report";
import { aggregateKpis } from "@/lib/report/aggregate";
import { rangeLengthDays } from "@/lib/dateRanges";

const RANGE = { startDate: "2026-06-23", endDate: "2026-07-22" };

describe("demo fixtures", () => {
  it("groups properties under their accounts", () => {
    const res = demoPropertiesResponse();
    expect(res.accounts.length).toBeGreaterThan(1);
    const total = res.accounts.reduce((n, a) => n + a.properties.length, 0);
    expect(total).toBe(DEMO_PROPERTIES.length);
  });

  it("uses unique property IDs", () => {
    const ids = DEMO_PROPERTIES.map((p) => p.propertyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks up a fixture by ID and returns undefined for unknown IDs", () => {
    expect(demoFixture(DEMO_PROPERTIES[0].propertyId)?.propertyName).toBe(
      DEMO_PROPERTIES[0].propertyName
    );
    expect(demoFixture("000000")).toBeUndefined();
  });
});

describe("demoPropertyReport", () => {
  const id = DEMO_PROPERTIES[0].propertyId;

  it("is deterministic for the same property and range", () => {
    const a = demoPropertyReport(id, RANGE, "previous_period");
    const b = demoPropertyReport(id, RANGE, "previous_period");
    expect(a).toEqual(b);
  });

  it("gives different properties different figures", () => {
    const a = demoPropertyReport(DEMO_PROPERTIES[0].propertyId, RANGE, "none");
    const b = demoPropertyReport(DEMO_PROPERTIES[1].propertyId, RANGE, "none");
    expect(a.kpis?.current.sessions).not.toBe(b.kpis?.current.sessions);
  });

  it("emits one trend point per day in the range", () => {
    const r = demoPropertyReport(id, RANGE, "none");
    expect(r.trend).toHaveLength(rangeLengthDays(RANGE));
    expect(r.trend?.[0].date).toBe("20260623");
    expect(r.trend?.at(-1)?.date).toBe("20260722");
  });

  it("includes a comparison period only when asked", () => {
    expect(demoPropertyReport(id, RANGE, "none").kpis?.previous).toBeUndefined();
    expect(demoPropertyReport(id, RANGE, "previous_period").kpis?.previous).toBeDefined();
  });

  it("keeps engagement rate a valid proportion", () => {
    for (const p of DEMO_PROPERTIES) {
      const rate = demoPropertyReport(p.propertyId, RANGE, "none").kpis?.current.engagementRate ?? 0;
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it("reports revenue only for properties configured with it", () => {
    for (const p of DEMO_PROPERTIES) {
      const r = demoPropertyReport(p.propertyId, RANGE, "none");
      expect(r.hasRevenue).toBe(p.hasRevenue);
      if (!p.hasRevenue) expect(r.kpis?.current.totalRevenue).toBe(0);
    }
  });

  it("marks unknown property IDs as failed rather than inventing data", () => {
    const r = demoPropertyReport("999999", RANGE, "none");
    expect(r.status).toBe("error");
  });
});

describe("demoReport", () => {
  it("labels itself as demo data and echoes the requested range", () => {
    const r = demoReport(DEMO_PROPERTIES.slice(0, 3).map((p) => p.propertyId), RANGE, "previous_period");
    expect(r.demo).toBe(true);
    expect(r.range).toEqual(RANGE);
    expect(r.compareRange).toEqual({ startDate: "2026-05-24", endDate: "2026-06-22" });
    expect(r.properties).toHaveLength(3);
  });

  it("combines revenue across the whole fixture set into one total", () => {
    const r = demoReport(DEMO_PROPERTIES.map((p) => p.propertyId), RANGE, "none");
    const agg = aggregateKpis(r.properties);
    expect(agg?.revenue.anyRevenue).toBe(true);
    const expected = r.properties
      .filter((p) => p.hasRevenue)
      .reduce((sum, p) => sum + (p.kpis?.current.totalRevenue ?? 0), 0);
    expect(agg?.current.totalRevenue).toBeCloseTo(expected, 6);
  });
});
