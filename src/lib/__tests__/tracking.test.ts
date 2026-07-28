import { describe, expect, it } from "vitest";
import { analyzeTracking, summarizeTracking } from "@/lib/report/tracking";
import type { EcommerceFunnel, KpiSet, PropertyReport } from "@/lib/types";

function kpis(partial: Partial<KpiSet> = {}): KpiSet {
  return {
    activeUsers: 0,
    newUsers: 0,
    sessions: 100,
    views: 0,
    engagementRate: 0,
    averageSessionDuration: 0,
    keyEvents: 0,
    totalRevenue: 0,
    ...partial,
  };
}

function funnel(partial: Partial<EcommerceFunnel> = {}): EcommerceFunnel {
  return {
    itemsViewed: 0,
    itemsAddedToCart: 0,
    itemsCheckedOut: 0,
    itemsPurchased: 0,
    ...partial,
  };
}

function site(overrides: Partial<PropertyReport> = {}): PropertyReport {
  return {
    propertyId: "1",
    propertyName: "Store",
    accountId: "a",
    accountName: "Account",
    currencyCode: "USD",
    timeZone: "UTC",
    status: "ok",
    hasRevenue: false,
    noData: false,
    kpis: { current: kpis() },
    ...overrides,
  } as PropertyReport;
}

const first = (p: PropertyReport) => analyzeTracking([p])[0];

describe("analyzeTracking", () => {
  it("flags a site with traffic but no ecommerce events at all", () => {
    const r = first(site());
    expect(r.severity).toBe("critical");
    expect(r.summary).toMatch(/no ecommerce events/i);
    expect(r.action).toMatch(/purchase/);
  });

  it("flags checkouts that never turn into purchases as critical", () => {
    const r = first(site({ funnel: funnel({ itemsViewed: 500, itemsAddedToCart: 90, itemsCheckedOut: 40 }) }));
    expect(r.severity).toBe("critical");
    expect(r.summary).toMatch(/checkouts are tracked/i);
    expect(r.action).toMatch(/order-confirmation/i);
  });

  it("warns when revenue arrives with no items attached", () => {
    const r = first(site({ kpis: { current: kpis({ totalRevenue: 900 }) } }));
    expect(r.severity).toBe("warning");
    expect(r.action).toMatch(/items array/i);
  });

  it("warns when purchases carry no revenue value", () => {
    const r = first(site({ funnel: funnel({ itemsViewed: 10, itemsAddedToCart: 5, itemsCheckedOut: 3, itemsPurchased: 2 }) }));
    expect(r.severity).toBe("warning");
    expect(r.action).toMatch(/value and currency/i);
  });

  it("warns when the checkout step is missing from the funnel", () => {
    const r = first(site({ funnel: funnel({ itemsViewed: 100, itemsAddedToCart: 20 }) }));
    expect(r.severity).toBe("warning");
    expect(r.action).toMatch(/begin_checkout/);
  });

  it("warns when add-to-cart is missing from the funnel", () => {
    const r = first(site({ funnel: funnel({ itemsViewed: 100 }) }));
    expect(r.severity).toBe("warning");
    expect(r.action).toMatch(/add_to_cart/);
  });

  it("passes a site that reports both purchases and revenue", () => {
    const r = first(
      site({
        kpis: { current: kpis({ totalRevenue: 1200 }) },
        funnel: funnel({ itemsViewed: 300, itemsAddedToCart: 60, itemsCheckedOut: 20, itemsPurchased: 12 }),
      })
    );
    expect(r.severity).toBe("ok");
    expect(r.action).toBeUndefined();
  });

  it("does not blame tracking when a site had no traffic", () => {
    expect(first(site({ kpis: { current: kpis({ sessions: 0 }) } })).severity).toBe("no_data");
  });

  it("reports a failed site separately from a tracking gap", () => {
    const r = first(
      site({ status: "error", error: { code: "quota", message: "Quota exceeded.", retryable: true } })
    );
    expect(r.severity).toBe("failed");
    expect(r.summary).toBe("Quota exceeded.");
  });

  it("treats itemised products as an ecommerce signal", () => {
    // Products present but no funnel: not "nothing at all".
    const r = first(site({ products: [{ key: "Urn", revenue: 50, quantity: 1 }] }));
    expect(r.severity).toBe("warning");
    expect(r.summary).not.toMatch(/no ecommerce events/i);
  });

  it("ranks critical gaps first, then the busiest sites", () => {
    const rows = analyzeTracking([
      site({
        propertyId: "healthy",
        kpis: { current: kpis({ sessions: 9000, totalRevenue: 100 }) },
        funnel: funnel({ itemsPurchased: 4 }),
      }),
      site({ propertyId: "broken-small", kpis: { current: kpis({ sessions: 10 }) } }),
      site({ propertyId: "broken-big", kpis: { current: kpis({ sessions: 5000 }) } }),
    ]);
    expect(rows.map((r) => r.propertyId)).toEqual(["broken-big", "broken-small", "healthy"]);
  });
});

describe("summarizeTracking", () => {
  it("counts each severity and the traffic being measured blind", () => {
    const stats = summarizeTracking(
      analyzeTracking([
        site({ propertyId: "1", kpis: { current: kpis({ sessions: 400 }) } }),
        site({ propertyId: "2", kpis: { current: kpis({ sessions: 600 }) } }),
        site({ propertyId: "3", kpis: { current: kpis({ totalRevenue: 10 }) } }),
        site({
          propertyId: "4",
          kpis: { current: kpis({ totalRevenue: 10 }) },
          funnel: funnel({ itemsPurchased: 1 }),
        }),
        site({ propertyId: "5", kpis: { current: kpis({ sessions: 0 }) } }),
      ])
    );
    expect(stats.critical).toBe(2);
    expect(stats.warning).toBe(1);
    expect(stats.ok).toBe(1);
    expect(stats.noData).toBe(1);
    expect(stats.sessionsAtRisk).toBe(1000);
  });

  it("returns zeroes for an empty report", () => {
    expect(summarizeTracking([])).toEqual({
      critical: 0,
      warning: 0,
      ok: 0,
      noData: 0,
      failed: 0,
      sessionsAtRisk: 0,
    });
  });
});
