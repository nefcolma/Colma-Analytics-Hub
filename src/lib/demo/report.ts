import { compareRangeFor, parseIso, rangeLengthDays } from "../dateRanges";
import type {
  CompareMode,
  DateRange,
  DimensionRow,
  KpiSet,
  PropertyReport,
  ReportResponse,
  TrendPoint,
} from "../types";
import { demoFixture } from "./fixtures";
import { hashString, mulberry32 } from "./random";

/** Deterministic, clearly-labeled demo data. Never shown as real analytics. */

const CHANNELS = ["Organic Search", "Direct", "Paid Search", "Referral", "Organic Social", "Email", "Unassigned"];
const SOURCES = [
  "google / organic",
  "(direct) / (none)",
  "google / cpc",
  "bing / organic",
  "facebook.com / referral",
  "newsletter / email",
  "linkedin.com / referral",
];
const PAGES: [string, string][] = [
  ["Home", "/"],
  ["Products", "/products"],
  ["About us", "/about"],
  ["Contact", "/contact"],
  ["Blog", "/blog"],
  ["Pricing", "/pricing"],
  ["Shipping and returns", "/shipping"],
  ["Support", "/support"],
];
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Mexico", "Australia", "Germany", "India"];
const DEVICES = ["desktop", "mobile", "tablet"];

function dailySeries(propertyId: string, range: DateRange, base: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  const start = parseIso(range.startDate);
  const len = rangeLengthDays(range);
  for (let i = 0; i < len; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    const rng = mulberry32(hashString(`${propertyId}:${key}`));
    const weekday = d.getUTCDay();
    const weekdayFactor = weekday === 0 || weekday === 6 ? 0.62 : 1;
    // Gentle upward drift over the year keeps comparisons interesting.
    const drift = 1 + ((d.getTime() / 86_400_000) % 365) * 0.0007;
    const users = Math.max(1, Math.round(base * weekdayFactor * drift * (0.75 + rng() * 0.5)));
    const sessions = Math.round(users * (1.15 + rng() * 0.3));
    points.push({ date: key, activeUsers: users, sessions });
  }
  return points;
}

function kpisFrom(propertyId: string, range: DateRange, base: number, hasRevenue: boolean): KpiSet {
  const trend = dailySeries(propertyId, range, base);
  const activeUsers = trend.reduce((s, t) => s + t.activeUsers, 0);
  const sessions = trend.reduce((s, t) => s + t.sessions, 0);
  const rng = mulberry32(hashString(`${propertyId}:${range.startDate}:${range.endDate}`));
  const engagementRate = 0.48 + rng() * 0.22;
  return {
    activeUsers,
    newUsers: Math.round(activeUsers * (0.55 + rng() * 0.15)),
    sessions,
    views: Math.round(sessions * (2.1 + rng() * 0.9)),
    engagementRate,
    averageSessionDuration: 95 + rng() * 140,
    keyEvents: Math.round(sessions * (0.02 + rng() * 0.03)),
    totalRevenue: hasRevenue ? Math.round(sessions * (1.4 + rng() * 2.2) * 100) / 100 : 0,
  };
}

function splitRows(
  propertyId: string,
  labels: string[],
  totals: { sessions: number; activeUsers: number; views: number; keyEvents: number },
  section: string
): DimensionRow[] {
  const rng = mulberry32(hashString(`${propertyId}:${section}`));
  const weights = labels.map((_, i) => Math.pow(0.62, i) * (0.8 + rng() * 0.4));
  const sum = weights.reduce((a, b) => a + b, 0);
  return labels.map((key, i) => {
    const share = weights[i] / sum;
    return {
      key,
      sessions: Math.round(totals.sessions * share),
      activeUsers: Math.round(totals.activeUsers * share),
      views: Math.round(totals.views * share),
      keyEvents: Math.round(totals.keyEvents * share),
      engagementRate: Math.min(0.92, Math.max(0.2, 0.45 + rng() * 0.35)),
    };
  });
}

export function demoPropertyReport(
  propertyId: string,
  range: DateRange,
  compare: CompareMode
): PropertyReport {
  const fixture = demoFixture(propertyId);
  if (!fixture) {
    return {
      propertyId,
      propertyName: `Property ${propertyId}`,
      accountName: "Unknown account",
      currencyCode: "USD",
      timeZone: "UTC",
      status: "error",
      hasRevenue: false,
      noData: false,
      error: { code: "not_found", message: "Property not found in demo data.", retryable: false },
    };
  }
  const compareRange = compareRangeFor(range, compare);
  const current = kpisFrom(propertyId, range, fixture.baseDailyUsers, fixture.hasRevenue);
  const previous = compareRange
    ? kpisFrom(propertyId, compareRange, fixture.baseDailyUsers * 0.94, fixture.hasRevenue)
    : undefined;
  const totals = {
    sessions: current.sessions,
    activeUsers: current.activeUsers,
    views: current.views,
    keyEvents: current.keyEvents,
  };
  const pages = splitRows(propertyId, PAGES.map(([t]) => t), totals, "pages").map((r, i) => ({
    ...r,
    detail: PAGES[i][1],
  }));
  return {
    propertyId,
    propertyName: fixture.propertyName,
    accountName: fixture.accountName,
    currencyCode: fixture.currencyCode ?? "USD",
    timeZone: fixture.timeZone ?? "UTC",
    status: "ok",
    hasRevenue: fixture.hasRevenue,
    noData: false,
    kpis: { current, previous },
    trend: dailySeries(propertyId, range, fixture.baseDailyUsers),
    channels: splitRows(propertyId, CHANNELS, totals, "channels"),
    sourceMedium: splitRows(propertyId, SOURCES, totals, "sourceMedium"),
    topPages: pages,
    landingPages: splitRows(propertyId, PAGES.map(([, p]) => p), totals, "landing"),
    geography: splitRows(propertyId, COUNTRIES, totals, "geo"),
    devices: splitRows(propertyId, DEVICES, totals, "devices"),
  };
}

export function demoReport(
  propertyIds: string[],
  range: DateRange,
  compare: CompareMode
): ReportResponse {
  return {
    demo: true,
    generatedAt: new Date().toISOString(),
    range,
    compare,
    compareRange: compareRangeFor(range, compare),
    properties: propertyIds.map((id) => demoPropertyReport(id, range, compare)),
  };
}
