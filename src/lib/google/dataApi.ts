import { fetchWithRetry } from "../retry";
import type { CompareMode, DateRange, PropertyReport, PropertySummary } from "../types";
import { compareRangeFor } from "../dateRanges";
import { errorFromStatus, GoogleApiError } from "./errors";
import {
  parseDimensionRows,
  parseFunnel,
  parseKpiReport,
  parseTrend,
  type RunReportResult,
} from "./normalize";

const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

type InnerRequest = {
  dateRanges: { startDate: string; endDate: string }[];
  metrics: { name: string }[];
  dimensions?: { name: string }[];
  orderBys?: unknown[];
  limit?: string;
  keepEmptyRows?: boolean;
};

const KPI_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "screenPageViews",
  "engagementRate",
  "averageSessionDuration",
  "keyEvents",
  "totalRevenue",
];

function buildRequests(range: DateRange, compareRange?: DateRange): InnerRequest[] {
  const single = [range];
  const kpiRanges = compareRange ? [range, compareRange] : [range];
  const descBy = (metric: string) => [{ metric: { metricName: metric }, desc: true }];
  return [
    { dateRanges: kpiRanges, metrics: KPI_METRICS.map((name) => ({ name })) },
    {
      dateRanges: single,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: "400",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "engagementRate" },
        { name: "keyEvents" },
        { name: "totalRevenue" },
      ],
      orderBys: descBy("sessions"),
      limit: "10",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "engagementRate" },
        { name: "keyEvents" },
        { name: "totalRevenue" },
      ],
      orderBys: descBy("sessions"),
      limit: "10",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "engagementRate" }],
      orderBys: descBy("screenPageViews"),
      limit: "10",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "keyEvents" }],
      orderBys: descBy("sessions"),
      limit: "10",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: descBy("activeUsers"),
      limit: "10",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: descBy("activeUsers"),
      limit: "4",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "itemName" }],
      metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }, { name: "itemsViewed" }],
      orderBys: descBy("itemRevenue"),
      limit: "10",
    },
    {
      dateRanges: single,
      dimensions: [{ name: "newVsReturning" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: descBy("activeUsers"),
      limit: "4",
    },
    // --- Optional sections (third batch, best-effort) ------------------------
    {
      dateRanges: single,
      dimensions: [{ name: "searchTerm" }],
      metrics: [{ name: "eventCount" }, { name: "activeUsers" }],
      orderBys: descBy("eventCount"),
      limit: "10",
    },
    {
      dateRanges: single,
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsCheckedOut" },
        { name: "itemsPurchased" },
      ],
    },
  ];
}

/** Requests 0..CORE_REQUESTS are required; the rest power optional sections. */
const CORE_REQUESTS = 10;

async function batchRunReports(
  propertyId: string,
  accessToken: string,
  requests: InnerRequest[]
): Promise<RunReportResult[]> {
  const res = await fetchWithRetry(
    `${DATA_BASE}/properties/${propertyId}:batchRunReports`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new GoogleApiError(errorFromStatus(res.status, `querying property ${propertyId}`));
  }
  const data = (await res.json()) as { reports?: RunReportResult[] };
  return data.reports ?? [];
}

/**
 * Runs the full report set for one property. Google allows up to 5 requests per
 * batchRunReports call, so the twelve queries take three HTTP calls.
 *
 * The first two batches carry the core report and must succeed. The third holds
 * the optional sections (site search, ecommerce funnel) and is best-effort: if
 * it fails — a property with those dimensions unavailable, a transient error —
 * the core report is still returned with those sections simply absent.
 */
export async function runPropertyReport(
  property: PropertySummary,
  accessToken: string,
  range: DateRange,
  compare: CompareMode
): Promise<PropertyReport> {
  const compareRange = compareRangeFor(range, compare);
  const requests = buildRequests(range, compareRange);
  const [first, second, extra] = await Promise.all([
    batchRunReports(property.propertyId, accessToken, requests.slice(0, 5)),
    batchRunReports(property.propertyId, accessToken, requests.slice(5, CORE_REQUESTS)),
    batchRunReports(property.propertyId, accessToken, requests.slice(CORE_REQUESTS)).catch(
      () => [] as RunReportResult[]
    ),
  ]);
  const [kpiR, trendR, channelsR, sourceR, pagesR] = first;
  const [landingR, geoR, devicesR, productsR, newReturnR] = second;
  const [searchR, funnelR] = extra;

  const kpis = parseKpiReport(kpiR, Boolean(compareRange));
  const currencyCode = kpiR?.metadata?.currencyCode ?? property.currencyCode ?? "USD";
  const timeZone = kpiR?.metadata?.timeZone ?? property.timeZone ?? "UTC";
  const hasRevenue =
    (kpis.current?.totalRevenue ?? 0) > 0 || (kpis.previous?.totalRevenue ?? 0) > 0;
  const noData = (kpis.current?.sessions ?? 0) === 0 && (kpis.current?.activeUsers ?? 0) === 0;

  return {
    propertyId: property.propertyId,
    propertyName: property.propertyName,
    accountName: property.accountName,
    currencyCode,
    timeZone,
    status: "ok",
    hasRevenue,
    noData,
    kpis: kpis.current
      ? { current: kpis.current, previous: kpis.previous }
      : undefined,
    trend: parseTrend(trendR),
    channels: parseDimensionRows(channelsR, ["sessions", "activeUsers", "engagementRate", "keyEvents", "revenue"]),
    sourceMedium: parseDimensionRows(sourceR, ["sessions", "activeUsers", "engagementRate", "keyEvents", "revenue"]),
    topPages: parseDimensionRows(pagesR, ["views", "activeUsers", "engagementRate"], true),
    landingPages: parseDimensionRows(landingR, ["sessions", "engagementRate", "keyEvents"]),
    geography: parseDimensionRows(geoR, ["activeUsers", "sessions"]),
    devices: parseDimensionRows(devicesR, ["activeUsers", "sessions"]),
    products: parseDimensionRows(productsR, ["revenue", "quantity", "views"]),
    newVsReturning: parseDimensionRows(newReturnR, ["activeUsers", "sessions"]),
    searchTerms: parseDimensionRows(searchR, ["events", "activeUsers"]),
    funnel: parseFunnel(funnelR),
  };
}
