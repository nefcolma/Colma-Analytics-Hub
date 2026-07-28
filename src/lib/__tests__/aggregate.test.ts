import { describe, expect, it } from "vitest";
import {
  aggregateFunnel,
  aggregateKpis,
  aggregateRows,
  aggregateTrend,
  bucketTrend,
} from "@/lib/report/aggregate";
import type { KpiSet, PropertyReport } from "@/lib/types";

function kpis(partial: Partial<KpiSet>): KpiSet {
  return {
    activeUsers: 0,
    newUsers: 0,
    sessions: 0,
    views: 0,
    engagementRate: 0,
    averageSessionDuration: 0,
    keyEvents: 0,
    totalRevenue: 0,
    ...partial,
  };
}

function prop(overrides: Partial<PropertyReport>): PropertyReport {
  return {
    propertyId: "1",
    propertyName: "Property",
    accountId: "a",
    accountName: "Account",
    timeZone: "America/Los_Angeles",
    currencyCode: "USD",
    status: "ok",
    hasRevenue: false,
    noData: false,
    ...overrides,
  } as PropertyReport;
}

describe("aggregateKpis", () => {
  it("returns null when nothing succeeded", () => {
    expect(aggregateKpis([prop({ status: "error" })])).toBeNull();
    expect(aggregateKpis([])).toBeNull();
  });

  it("sums count metrics across properties", () => {
    const agg = aggregateKpis([
      prop({ propertyId: "1", kpis: { current: kpis({ activeUsers: 100, sessions: 120, views: 400, keyEvents: 5 }) } }),
      prop({ propertyId: "2", kpis: { current: kpis({ activeUsers: 50, sessions: 80, views: 150, keyEvents: 3 }) } }),
    ]);
    expect(agg?.current.activeUsers).toBe(150);
    expect(agg?.current.sessions).toBe(200);
    expect(agg?.current.views).toBe(550);
    expect(agg?.current.keyEvents).toBe(8);
  });

  it("weights engagement rate and session duration by sessions, not by property count", () => {
    const agg = aggregateKpis([
      prop({ propertyId: "1", kpis: { current: kpis({ sessions: 900, engagementRate: 0.8, averageSessionDuration: 100 }) } }),
      prop({ propertyId: "2", kpis: { current: kpis({ sessions: 100, engagementRate: 0.3, averageSessionDuration: 50 }) } }),
    ]);
    // Naive mean would be 0.55; session-weighted is 0.75.
    expect(agg?.current.engagementRate).toBeCloseTo(0.75, 10);
    expect(agg?.current.averageSessionDuration).toBeCloseTo(95, 10);
  });

  it("leaves rates at zero when there are no sessions", () => {
    const agg = aggregateKpis([
      prop({ kpis: { current: kpis({ sessions: 0, engagementRate: 0.5 }) } }),
    ]);
    expect(agg?.current.engagementRate).toBe(0);
    expect(agg?.current.averageSessionDuration).toBe(0);
  });

  it("sums revenue across properties", () => {
    const agg = aggregateKpis([
      prop({ propertyId: "1", hasRevenue: true, currencyCode: "USD", kpis: { current: kpis({ totalRevenue: 1200 }) } }),
      prop({ propertyId: "2", hasRevenue: true, currencyCode: "USD", kpis: { current: kpis({ totalRevenue: 300 }) } }),
    ]);
    expect(agg?.revenue.anyRevenue).toBe(true);
    expect(agg?.revenue.currency).toBe("USD");
    expect(agg?.current.totalRevenue).toBe(1500);
  });

  it("labels the combined total with the currency carrying the most revenue", () => {
    const agg = aggregateKpis([
      prop({ propertyId: "1", hasRevenue: true, currencyCode: "USD", kpis: { current: kpis({ totalRevenue: 1000 }) } }),
      prop({ propertyId: "2", hasRevenue: true, currencyCode: "CAD", kpis: { current: kpis({ totalRevenue: 400 }) } }),
    ]);
    expect(agg?.current.totalRevenue).toBe(1400);
    expect(agg?.revenue.currency).toBe("USD");
  });

  it("ignores revenue from properties that do not report it", () => {
    const agg = aggregateKpis([
      prop({ propertyId: "1", hasRevenue: false, kpis: { current: kpis({ totalRevenue: 999 }) } }),
    ]);
    expect(agg?.revenue.anyRevenue).toBe(false);
    expect(agg?.current.totalRevenue).toBe(0);
  });

  it("aggregates the comparison period alongside the current one", () => {
    const agg = aggregateKpis([
      prop({
        propertyId: "1",
        hasRevenue: true,
        currencyCode: "USD",
        kpis: {
          current: kpis({ sessions: 200, totalRevenue: 500 }),
          previous: kpis({ sessions: 100, totalRevenue: 250 }),
        },
      }),
    ]);
    expect(agg?.previous?.sessions).toBe(100);
    expect(agg?.previous?.totalRevenue).toBe(250);
  });

  it("excludes failed properties from the totals", () => {
    const agg = aggregateKpis([
      prop({ propertyId: "1", kpis: { current: kpis({ sessions: 100 }) } }),
      prop({ propertyId: "2", status: "error", kpis: { current: kpis({ sessions: 5000 }) } }),
    ]);
    expect(agg?.current.sessions).toBe(100);
  });
});

describe("aggregateTrend", () => {
  it("merges points by date and sorts chronologically", () => {
    const trend = aggregateTrend([
      prop({
        propertyId: "1",
        trend: [
          { date: "20260702", activeUsers: 5, sessions: 6 },
          { date: "20260701", activeUsers: 10, sessions: 12 },
        ],
      }),
      prop({
        propertyId: "2",
        trend: [{ date: "20260701", activeUsers: 3, sessions: 4 }],
      }),
    ]);
    expect(trend).toEqual([
      { date: "20260701", activeUsers: 13, sessions: 16 },
      { date: "20260702", activeUsers: 5, sessions: 6 },
    ]);
  });

  it("skips failed properties", () => {
    expect(
      aggregateTrend([
        prop({ status: "error", trend: [{ date: "20260701", activeUsers: 9, sessions: 9 }] }),
      ])
    ).toEqual([]);
  });
});

describe("aggregateRows", () => {
  it("merges matching keys, sums counts, and sorts by volume", () => {
    const rows = aggregateRows(
      [
        prop({
          propertyId: "1",
          channels: [
            { key: "Organic Search", sessions: 100, activeUsers: 80, engagementRate: 0.5, keyEvents: 4 },
            { key: "Direct", sessions: 40, activeUsers: 35, engagementRate: 0.4, keyEvents: 1 },
          ],
        }),
        prop({
          propertyId: "2",
          channels: [
            { key: "Organic Search", sessions: 100, activeUsers: 70, engagementRate: 0.9, keyEvents: 6 },
          ],
        }),
      ],
      (p) => p.channels
    );
    expect(rows.map((r) => r.key)).toEqual(["Organic Search", "Direct"]);
    expect(rows[0].sessions).toBe(200);
    expect(rows[0].keyEvents).toBe(10);
    // Equal session weights -> midpoint of 0.5 and 0.9
    expect(rows[0].engagementRate).toBeCloseTo(0.7, 6);
  });

  it("keys rows on key plus detail so identical titles at different paths stay separate", () => {
    const rows = aggregateRows(
      [
        prop({
          topPages: [
            { key: "Home", detail: "/", views: 10 },
            { key: "Home", detail: "/index.html", views: 4 },
          ],
        }),
      ],
      (p) => p.topPages
    );
    expect(rows).toHaveLength(2);
  });

  it("honours the row limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}`, sessions: i }));
    expect(aggregateRows([prop({ channels: many })], (p) => p.channels, 10)).toHaveLength(10);
  });

  it("sums revenue, quantity, and event counts so no metric is dropped", () => {
    const rows = aggregateRows(
      [
        prop({ propertyId: "1", searchTerms: [{ key: "wood urn", events: 30, activeUsers: 20 }] }),
        prop({ propertyId: "2", searchTerms: [{ key: "wood urn", events: 12, activeUsers: 9 }] }),
      ],
      (p) => p.searchTerms
    );
    expect(rows[0].events).toBe(42);
    expect(rows[0].activeUsers).toBe(29);

    const items = aggregateRows(
      [
        prop({ propertyId: "1", products: [{ key: "Metal Urn", revenue: 100, quantity: 2 }] }),
        prop({ propertyId: "2", products: [{ key: "Metal Urn", revenue: 50, quantity: 1 }] }),
      ],
      (p) => p.products,
      10,
      (r) => r.revenue ?? 0
    );
    expect(items[0].revenue).toBe(150);
    expect(items[0].quantity).toBe(3);
  });

  it("ranks by the supplied sort value instead of the volume metric", () => {
    const rows = aggregateRows(
      [
        prop({
          products: [
            { key: "Low revenue, many views", revenue: 10, views: 5000 },
            { key: "High revenue, few views", revenue: 900, views: 10 },
          ],
        }),
      ],
      (p) => p.products,
      10,
      (r) => r.revenue ?? 0
    );
    expect(rows[0].key).toBe("High revenue, few views");
  });

  it("does not leak the internal weight field", () => {
    const rows = aggregateRows([prop({ channels: [{ key: "Direct", sessions: 5 }] })], (p) => p.channels);
    expect(Object.keys(rows[0])).not.toContain("_w");
  });
});

describe("aggregateFunnel", () => {
  const funnel = (v: number) => ({
    itemsViewed: v * 10,
    itemsAddedToCart: v * 4,
    itemsCheckedOut: v * 2,
    itemsPurchased: v,
  });

  it("returns null when no site reported a funnel", () => {
    expect(aggregateFunnel([prop({})])).toBeNull();
    expect(aggregateFunnel([])).toBeNull();
  });

  it("sums every stage across sites", () => {
    const total = aggregateFunnel([
      prop({ propertyId: "1", funnel: funnel(10) }),
      prop({ propertyId: "2", funnel: funnel(5) }),
    ]);
    expect(total).toEqual({
      itemsViewed: 150,
      itemsAddedToCart: 60,
      itemsCheckedOut: 30,
      itemsPurchased: 15,
    });
  });

  it("ignores failed sites and sites without a funnel", () => {
    const total = aggregateFunnel([
      prop({ propertyId: "1", funnel: funnel(1) }),
      prop({ propertyId: "2", status: "error", funnel: funnel(99) }),
      prop({ propertyId: "3" }),
    ]);
    expect(total).toEqual(funnel(1));
  });
});

describe("bucketTrend", () => {
  const daily = [
    { date: "20260629", activeUsers: 1, sessions: 1 }, // Monday
    { date: "20260630", activeUsers: 2, sessions: 2 },
    { date: "20260705", activeUsers: 4, sessions: 4 }, // Sunday, same ISO week
    { date: "20260706", activeUsers: 8, sessions: 8 }, // next Monday
  ];

  it("returns daily points untouched", () => {
    expect(bucketTrend(daily, "daily")).toBe(daily);
  });

  it("buckets into ISO weeks starting Monday", () => {
    const weekly = bucketTrend(daily, "weekly");
    expect(weekly.map((p) => p.date)).toEqual(["20260629", "20260706"]);
    expect(weekly[0].sessions).toBe(7);
    expect(weekly[1].sessions).toBe(8);
  });

  it("buckets into calendar months", () => {
    const monthly = bucketTrend(daily, "monthly");
    expect(monthly.map((p) => p.date)).toEqual(["20260601", "20260701"]);
    expect(monthly[0].sessions).toBe(3);
    expect(monthly[1].sessions).toBe(12);
  });

  it("handles an empty series", () => {
    expect(bucketTrend([], "weekly")).toEqual([]);
  });
});
