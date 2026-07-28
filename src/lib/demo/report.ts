import { compareRangeFor, parseIso, rangeLengthDays } from "../dateRanges";
import type {
  CompareMode,
  DateRange,
  DimensionRow,
  EcommerceFunnel,
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
  section: string,
  revenueTotal = 0
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
      ...(revenueTotal > 0 ? { revenue: Math.round(revenueTotal * share * 100) / 100 } : {}),
    };
  });
}

const DEMO_PRODUCTS = [
  "Metal Urn — Classic",
  "Wood Urn — Oak",
  "Biodegradable Urn",
  "Memorial Necklace",
  "Cremation Pendant",
  "Marble Keepsake Urn",
  "Pet Urn — Small",
  "Photo Memorial Frame",
];

/** Demo best-selling items, generated only for properties that report revenue. */
function demoProducts(propertyId: string, revenueTotal: number): DimensionRow[] {
  if (revenueTotal <= 0) return [];
  const rng = mulberry32(hashString(`${propertyId}:products`));
  const weights = DEMO_PRODUCTS.map((_, i) => Math.pow(0.7, i) * (0.8 + rng() * 0.4));
  const sum = weights.reduce((a, b) => a + b, 0);
  // Attribute ~85% of site revenue to itemised products.
  return DEMO_PRODUCTS.map((key, i) => {
    const revenue = Math.round(revenueTotal * 0.85 * (weights[i] / sum) * 100) / 100;
    const avgPrice = 60 + rng() * 190;
    const quantity = Math.max(1, Math.round(revenue / avgPrice));
    return { key, revenue, quantity, views: Math.round(quantity * (8 + rng() * 22)) };
  });
}

const DEMO_SEARCH_TERMS = [
  "cremation urns",
  "wood urn",
  "urn for ashes",
  "pet urn",
  "memorial jewelry",
  "biodegradable urn",
  "keepsake urn",
  "shipping time",
];

/** Demo on-site search terms, scaled to the site's traffic. */
function demoSearchTerms(propertyId: string, sessions: number): DimensionRow[] {
  const rng = mulberry32(hashString(`${propertyId}:search`));
  // Roughly 4% of sessions run an on-site search.
  const searches = Math.round(sessions * (0.03 + rng() * 0.02));
  if (searches < DEMO_SEARCH_TERMS.length) return [];
  const weights = DEMO_SEARCH_TERMS.map((_, i) => Math.pow(0.68, i) * (0.8 + rng() * 0.4));
  const sum = weights.reduce((a, b) => a + b, 0);
  return DEMO_SEARCH_TERMS.map((key, i) => {
    const events = Math.max(1, Math.round(searches * (weights[i] / sum)));
    return { key, events, activeUsers: Math.max(1, Math.round(events * (0.7 + rng() * 0.2))) };
  });
}

/** Demo ecommerce funnel, only for sites that report revenue. */
function demoFunnel(
  propertyId: string,
  views: number,
  hasRevenue: boolean
): EcommerceFunnel | undefined {
  if (!hasRevenue) return undefined;
  const rng = mulberry32(hashString(`${propertyId}:funnel`));
  const itemsViewed = Math.round(views * (0.25 + rng() * 0.1));
  const itemsAddedToCart = Math.round(itemsViewed * (0.18 + rng() * 0.08));
  const itemsCheckedOut = Math.round(itemsAddedToCart * (0.55 + rng() * 0.15));
  const itemsPurchased = Math.round(itemsCheckedOut * (0.6 + rng() * 0.2));
  return { itemsViewed, itemsAddedToCart, itemsCheckedOut, itemsPurchased };
}

/** Demo split of active users / sessions into new vs returning. */
function demoNewReturning(propertyId: string, activeUsers: number, sessions: number): DimensionRow[] {
  const rng = mulberry32(hashString(`${propertyId}:newret`));
  const newShare = 0.55 + rng() * 0.2;
  return [
    {
      key: "new",
      activeUsers: Math.round(activeUsers * newShare),
      sessions: Math.round(sessions * newShare),
    },
    {
      key: "returning",
      activeUsers: Math.round(activeUsers * (1 - newShare)),
      sessions: Math.round(sessions * (1 - newShare)),
    },
  ];
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
    channels: splitRows(propertyId, CHANNELS, totals, "channels", current.totalRevenue),
    sourceMedium: splitRows(propertyId, SOURCES, totals, "sourceMedium", current.totalRevenue),
    topPages: pages,
    landingPages: splitRows(propertyId, PAGES.map(([, p]) => p), totals, "landing"),
    geography: splitRows(propertyId, COUNTRIES, totals, "geo"),
    devices: splitRows(propertyId, DEVICES, totals, "devices"),
    products: demoProducts(propertyId, current.totalRevenue),
    newVsReturning: demoNewReturning(propertyId, current.activeUsers, current.sessions),
    searchTerms: demoSearchTerms(propertyId, current.sessions),
    funnel: demoFunnel(propertyId, current.views, fixture.hasRevenue),
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
