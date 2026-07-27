import type { DimensionRow, KpiSet, TrendPoint } from "../types";

/** Normalizes raw Google Analytics Data API responses into typed structures. */

export type RunReportResult = {
  dimensionHeaders?: { name?: string }[];
  metricHeaders?: { name?: string }[];
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  rowCount?: number;
  metadata?: { currencyCode?: string; timeZone?: string };
};

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyKpis(): KpiSet {
  return {
    activeUsers: 0,
    newUsers: 0,
    sessions: 0,
    views: 0,
    engagementRate: 0,
    averageSessionDuration: 0,
    keyEvents: 0,
    totalRevenue: 0,
  };
}

function kpisFromValues(values: { value?: string }[]): KpiSet {
  return {
    activeUsers: num(values[0]?.value),
    newUsers: num(values[1]?.value),
    sessions: num(values[2]?.value),
    views: num(values[3]?.value),
    engagementRate: num(values[4]?.value),
    averageSessionDuration: num(values[5]?.value),
    keyEvents: num(values[6]?.value),
    totalRevenue: num(values[7]?.value),
  };
}

/**
 * Parses the KPI report. When two date ranges are requested, GA adds an
 * implicit `dateRange` dimension with values `date_range_0` / `date_range_1`.
 */
export function parseKpiReport(
  report: RunReportResult | undefined,
  hasCompare: boolean
): { current?: KpiSet; previous?: KpiSet } {
  if (!report) return {};
  const rows = report.rows ?? [];
  if (!hasCompare) {
    return { current: rows[0] ? kpisFromValues(rows[0].metricValues ?? []) : emptyKpis() };
  }
  let current: KpiSet | undefined;
  let previous: KpiSet | undefined;
  for (const row of rows) {
    const label = row.dimensionValues?.[0]?.value;
    if (label === "date_range_0") current = kpisFromValues(row.metricValues ?? []);
    else if (label === "date_range_1") previous = kpisFromValues(row.metricValues ?? []);
  }
  return { current: current ?? emptyKpis(), previous: previous ?? emptyKpis() };
}

export function parseTrend(report: RunReportResult | undefined): TrendPoint[] {
  return (report?.rows ?? [])
    .map((row) => ({
      date: row.dimensionValues?.[0]?.value ?? "",
      activeUsers: num(row.metricValues?.[0]?.value),
      sessions: num(row.metricValues?.[1]?.value),
    }))
    .filter((t) => /^\d{8}$/.test(t.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

type MetricKey =
  | "sessions"
  | "activeUsers"
  | "views"
  | "engagementRate"
  | "keyEvents"
  | "revenue"
  | "quantity";

/**
 * Parses a single-dimension (or two-dimension, when `withDetail`) report where
 * `metricOrder` names the metrics in request order.
 */
export function parseDimensionRows(
  report: RunReportResult | undefined,
  metricOrder: MetricKey[],
  withDetail = false
): DimensionRow[] {
  return (report?.rows ?? []).map((row) => {
    const out: DimensionRow = {
      key: row.dimensionValues?.[0]?.value || "(not set)",
    };
    if (withDetail) out.detail = row.dimensionValues?.[1]?.value ?? "";
    metricOrder.forEach((metric, i) => {
      out[metric] = num(row.metricValues?.[i]?.value);
    });
    return out;
  });
}
