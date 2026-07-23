import { describe, expect, it } from "vitest";
import { buildSectionCsv, buildSummaryCsv, sectionLabel, toCsv } from "@/lib/csv";
import type { KpiSet, PropertyReport, ReportResponse } from "@/lib/types";

const BOM = "\ufeff";

function kpis(partial: Partial<KpiSet> = {}): KpiSet {
  return {
    activeUsers: 120,
    newUsers: 44,
    sessions: 150,
    views: 380,
    engagementRate: 0.61,
    averageSessionDuration: 92,
    keyEvents: 7,
    totalRevenue: 0,
    ...partial,
  };
}

const okProperty: PropertyReport = {
  propertyId: "263501877",
  propertyName: "UPD Urns Store",
  accountId: "acc-4",
  accountName: "UPD Urns Current",
  timeZone: "America/Los_Angeles",
  currencyCode: "USD",
  status: "ok",
  hasRevenue: true,
  noData: false,
  kpis: { current: kpis({ totalRevenue: 4820.5 }) },
  channels: [{ key: "Organic Search", sessions: 90, activeUsers: 70, engagementRate: 0.66, keyEvents: 5 }],
  trend: [{ date: "20260701", activeUsers: 12, sessions: 14 }],
  devices: [{ key: "mobile", activeUsers: 80, sessions: 95 }],
} as PropertyReport;

const failedProperty: PropertyReport = {
  propertyId: "441209563",
  propertyName: "UPD Field Services",
  accountId: "acc-4",
  accountName: "UPD Urns Current",
  timeZone: "America/Vancouver",
  currencyCode: "CAD",
  status: "error",
  hasRevenue: false,
  noData: false,
  error: { code: "quota", message: "Quota exceeded for this property.", retryable: true },
} as PropertyReport;

const report: ReportResponse = {
  generatedAt: "2026-07-23T18:00:00.000Z",
  range: { startDate: "2026-06-23", endDate: "2026-07-22" },
  compare: "previous_period",
  compareRange: { startDate: "2026-05-24", endDate: "2026-06-22" },
  demo: false,
  properties: [okProperty, failedProperty],
};

describe("toCsv", () => {
  it("prefixes a BOM and joins with CRLF", () => {
    const csv = toCsv([["a", "b"], [1, 2]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a,b\r\n1,2`);
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv([["plain", "has,comma", 'has"quote', "has\nnewline"]]);
    expect(csv).toBe(`${BOM}plain,"has,comma","has""quote","has\nnewline"`);
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([[null, undefined, 0]])).toBe(`${BOM},,0`);
  });
});

describe("buildSummaryCsv", () => {
  const csv = buildSummaryCsv(report);

  it("includes report metadata before the table", () => {
    expect(csv).toContain("Colma Analytics Hub");
    expect(csv).toContain("2026-06-23 to 2026-07-22");
    expect(csv).toContain("Compared to");
    expect(csv).toContain("2026-05-24 to 2026-06-22");
    expect(csv).toContain("2026-07-23T18:00:00.000Z");
  });

  it("writes one row per property including failures with their reason", () => {
    expect(csv).toContain("UPD Urns Store");
    expect(csv).toContain("263501877");
    expect(csv).toContain("4820.5");
    expect(csv).toContain("Quota exceeded");
  });

  it("does not mark real reports as demo data", () => {
    expect(csv).not.toContain("Demo data");
  });

  it("marks demo reports so exports are never mistaken for real figures", () => {
    expect(buildSummaryCsv({ ...report, demo: true })).toContain("Demo data");
  });

  it("names a single-property scope after that property", () => {
    const single = buildSummaryCsv({ ...report, properties: [okProperty] });
    expect(single).toContain("UPD Urns Store (263501877)");
  });
});

describe("buildSectionCsv", () => {
  it("exports consolidated channel rows", () => {
    const csv = buildSectionCsv(report, "channels");
    expect(csv).toContain("Organic Search");
    expect(csv).toContain("90");
  });

  it("exports the trend series", () => {
    expect(buildSectionCsv(report, "trend")).toContain("20260701");
  });

  it("still emits metadata when a section has no rows", () => {
    const csv = buildSectionCsv({ ...report, properties: [failedProperty] }, "geography");
    expect(csv).toContain("Colma Analytics Hub");
  });
});

describe("sectionLabel", () => {
  it("gives every section a human-readable name", () => {
    expect(sectionLabel("sourceMedium")).toMatch(/source/i);
    expect(sectionLabel("landingPages")).toMatch(/landing/i);
    expect(sectionLabel("devices")).toMatch(/device/i);
  });
});
