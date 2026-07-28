import { conversionRate } from "./format";
import type { PropertyReport, ReportResponse } from "./types";

/** RFC 4180-style CSV with a UTF-8 BOM so Excel opens it cleanly. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
}

function metaRows(report: ReportResponse, scope: string): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Colma Analytics Hub"],
    ["Report scope", scope],
    ["Date range", `${report.range.startDate} to ${report.range.endDate}`],
  ];
  if (report.compareRange) {
    rows.push([
      "Compared to",
      `${report.compareRange.startDate} to ${report.compareRange.endDate}`,
    ]);
  }
  rows.push(["Generated at", report.generatedAt]);
  if (report.demo) rows.push(["Data source", "Demo data (not real analytics)"]);
  rows.push([]);
  return rows;
}

export function buildSummaryCsv(report: ReportResponse): string {
  const ok = report.properties;
  const scope =
    ok.length === 1 ? `${ok[0].propertyName} (${ok[0].propertyId})` : `${ok.length} sites`;
  const rows: (string | number | null)[][] = [
    ...metaRows(report, scope),
    [
      "Site name",
      "Site ID",
      "Account",
      "Status",
      "Active users",
      "New users",
      "Sessions",
      "Views",
      "Engagement rate",
      "Avg. session duration (s)",
      "Key events",
      "Conversion rate",
      "Total revenue",
      "Currency",
      "Time zone",
    ],
  ];
  for (const p of report.properties) {
    const k = p.kpis?.current;
    rows.push([
      p.propertyName,
      p.propertyId,
      p.accountName,
      p.status === "ok" ? (p.noData ? "No data" : "OK") : `Failed: ${p.error?.message ?? "error"}`,
      k?.activeUsers ?? null,
      k?.newUsers ?? null,
      k?.sessions ?? null,
      k?.views ?? null,
      k ? +(k.engagementRate * 100).toFixed(2) : null,
      k ? Math.round(k.averageSessionDuration) : null,
      k?.keyEvents ?? null,
      k ? +(conversionRate(k.keyEvents, k.sessions) * 100).toFixed(3) : null,
      p.hasRevenue && k ? +k.totalRevenue.toFixed(2) : null,
      p.currencyCode,
      p.timeZone,
    ]);
  }
  return toCsv(rows);
}

const SECTION_HEADERS = {
  trend: ["Date", "Active users", "Sessions"],
  channels: ["Default channel group", "Sessions", "Active users", "Engagement rate", "Key events", "Revenue"],
  sourceMedium: ["Source / medium", "Sessions", "Active users", "Engagement rate", "Key events", "Revenue"],
  topPages: ["Page title", "Page path", "Views", "Active users", "Engagement rate"],
  landingPages: ["Landing page", "Sessions", "Engagement rate", "Key events"],
  geography: ["Country", "Active users", "Sessions"],
  devices: ["Device category", "Active users", "Sessions"],
  products: ["Product", "Revenue", "Units sold", "Views"],
  newVsReturning: ["Type", "Active users", "Sessions"],
  searchTerms: ["Search term", "Searches", "Active users"],
  funnel: ["Stage", "Items"],
} as const satisfies Record<string, readonly string[]>;

export type CsvSection = keyof typeof SECTION_HEADERS;

export function buildSectionCsv(report: ReportResponse, section: CsvSection): string {
  const rows: (string | number | null)[][] = [...metaRows(report, sectionLabel(section))];
  for (const p of report.properties) {
    if (p.status !== "ok") continue;
    rows.push([`${p.propertyName} (${p.propertyId})`]);
    rows.push([...SECTION_HEADERS[section]]);
    rows.push(...sectionRows(p, section));
    rows.push([]);
  }
  return toCsv(rows);
}

export function sectionLabel(section: CsvSection): string {
  const labels: Record<CsvSection, string> = {
    trend: "Traffic trend",
    channels: "Traffic acquisition (channel group)",
    sourceMedium: "Traffic acquisition (source/medium)",
    topPages: "Top pages",
    landingPages: "Landing pages",
    geography: "Geography",
    devices: "Devices",
    products: "Top products",
    newVsReturning: "New vs returning",
    searchTerms: "Site search terms",
    funnel: "Ecommerce funnel",
  };
  return labels[section];
}

function sectionRows(p: PropertyReport, section: CsvSection): (string | number | null)[][] {
  const pct = (r?: number) => (r === undefined ? null : +(r * 100).toFixed(2));
  switch (section) {
    case "trend":
      return (p.trend ?? []).map((t) => [t.date, t.activeUsers, t.sessions]);
    case "channels":
    case "sourceMedium":
      return ((section === "channels" ? p.channels : p.sourceMedium) ?? []).map((r) => [
        r.key,
        r.sessions ?? null,
        r.activeUsers ?? null,
        pct(r.engagementRate),
        r.keyEvents ?? null,
        r.revenue ?? null,
      ]);
    case "products":
      return (p.products ?? []).map((r) => [
        r.key,
        r.revenue ?? null,
        r.quantity ?? null,
        r.views ?? null,
      ]);
    case "newVsReturning":
      return (p.newVsReturning ?? []).map((r) => [r.key, r.activeUsers ?? null, r.sessions ?? null]);
    case "searchTerms":
      return (p.searchTerms ?? []).map((r) => [r.key, r.events ?? null, r.activeUsers ?? null]);
    case "funnel":
      return p.funnel
        ? [
            ["Viewed", p.funnel.itemsViewed],
            ["Added to cart", p.funnel.itemsAddedToCart],
            ["Checked out", p.funnel.itemsCheckedOut],
            ["Purchased", p.funnel.itemsPurchased],
          ]
        : [];
    case "topPages":
      return (p.topPages ?? []).map((r) => [
        r.key,
        r.detail ?? "",
        r.views ?? null,
        r.activeUsers ?? null,
        pct(r.engagementRate),
      ]);
    case "landingPages":
      return (p.landingPages ?? []).map((r) => [
        r.key,
        r.sessions ?? null,
        pct(r.engagementRate),
        r.keyEvents ?? null,
      ]);
    case "geography":
    case "devices":
      return ((section === "geography" ? p.geography : p.devices) ?? []).map((r) => [
        r.key,
        r.activeUsers ?? null,
        r.sessions ?? null,
      ]);
    default: {
      // Exhaustiveness guard: adding a CsvSection without a case fails to compile.
      const _never: never = section;
      void _never;
      return [];
    }
  }
}
