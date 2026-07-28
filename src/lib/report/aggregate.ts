import type {
  DimensionRow,
  EcommerceFunnel,
  KpiSet,
  PropertyReport,
  TrendPoint,
} from "../types";

/**
 * Combines per-property results into consolidated figures for the overview.
 * Counts are summed; rates and durations are weighted by sessions. Revenue is
 * summed across every revenue-reporting property into a single total, labelled
 * with the currency used by the largest share of that revenue.
 */

export type AggregatedKpis = {
  current: KpiSet;
  previous?: KpiSet;
  revenue: {
    /** Currency label for the combined total. */
    currency: string;
    anyRevenue: boolean;
  };
};

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

function addWeighted(target: KpiSet, source: KpiSet) {
  target.activeUsers += source.activeUsers;
  target.newUsers += source.newUsers;
  target.sessions += source.sessions;
  target.views += source.views;
  target.keyEvents += source.keyEvents;
  // Accumulate weighted numerators; divide by sessions at the end.
  target.engagementRate += source.engagementRate * source.sessions;
  target.averageSessionDuration += source.averageSessionDuration * source.sessions;
}

function finalizeWeighted(k: KpiSet) {
  if (k.sessions > 0) {
    k.engagementRate /= k.sessions;
    k.averageSessionDuration /= k.sessions;
  } else {
    k.engagementRate = 0;
    k.averageSessionDuration = 0;
  }
}

export function aggregateKpis(properties: PropertyReport[]): AggregatedKpis | null {
  const ok = properties.filter((p) => p.status === "ok" && p.kpis);
  if (ok.length === 0) return null;

  const current = emptyKpis();
  const hasPrevious = ok.some((p) => p.kpis?.previous);
  const previous = hasPrevious ? emptyKpis() : undefined;

  // Track revenue per currency only to decide which label the combined total
  // carries; the total itself is a straight sum.
  const revenueByCurrency = new Map<string, number>();
  let anyRevenue = false;

  for (const p of ok) {
    const k = p.kpis!;
    addWeighted(current, k.current);
    if (previous && k.previous) addWeighted(previous, k.previous);

    if (p.hasRevenue) {
      anyRevenue = true;
      current.totalRevenue += k.current.totalRevenue;
      if (previous && k.previous) previous.totalRevenue += k.previous.totalRevenue;
      revenueByCurrency.set(
        p.currencyCode,
        (revenueByCurrency.get(p.currencyCode) ?? 0) + k.current.totalRevenue
      );
    }
  }

  finalizeWeighted(current);
  if (previous) finalizeWeighted(previous);

  const currency =
    [...revenueByCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  return { current, previous, revenue: { currency, anyRevenue } };
}

export function aggregateTrend(properties: PropertyReport[]): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const p of properties) {
    if (p.status !== "ok") continue;
    for (const t of p.trend ?? []) {
      const cur = byDate.get(t.date) ?? { date: t.date, activeUsers: 0, sessions: 0 };
      cur.activeUsers += t.activeUsers;
      cur.sessions += t.sessions;
      byDate.set(t.date, cur);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge dimension tables across properties. Counts (including revenue and
 * quantity) are summed; rates are weighted by the row's volume metric. Rows are
 * ranked by `sortValue` when given (e.g. item revenue for products), otherwise
 * by their volume metric.
 */
export function aggregateRows(
  properties: PropertyReport[],
  pick: (p: PropertyReport) => DimensionRow[] | undefined,
  limit = 25,
  sortValue?: (r: DimensionRow) => number
): DimensionRow[] {
  const map = new Map<string, DimensionRow & { _w: number }>();
  for (const p of properties) {
    if (p.status !== "ok") continue;
    for (const r of pick(p) ?? []) {
      const id = `${r.key}\u0000${r.detail ?? ""}`;
      const cur =
        map.get(id) ??
        ({ key: r.key, detail: r.detail, _w: 0 } as DimensionRow & { _w: number });
      const weight = r.sessions ?? r.views ?? r.activeUsers ?? 0;
      cur.sessions = (cur.sessions ?? 0) + (r.sessions ?? 0);
      cur.activeUsers = (cur.activeUsers ?? 0) + (r.activeUsers ?? 0);
      cur.views = (cur.views ?? 0) + (r.views ?? 0);
      cur.keyEvents = (cur.keyEvents ?? 0) + (r.keyEvents ?? 0);
      cur.revenue = (cur.revenue ?? 0) + (r.revenue ?? 0);
      cur.quantity = (cur.quantity ?? 0) + (r.quantity ?? 0);
      cur.events = (cur.events ?? 0) + (r.events ?? 0);
      if (r.engagementRate !== undefined) {
        cur.engagementRate = ((cur.engagementRate ?? 0) * cur._w + r.engagementRate * weight) /
          Math.max(1, cur._w + weight);
      }
      cur._w += weight;
      map.set(id, cur);
    }
  }
  const rank = sortValue ?? ((r: DimensionRow) => r.sessions ?? r.views ?? r.activeUsers ?? 0);
  return [...map.values()]
    .map((row) => {
      const rest = { ...row } as DimensionRow & { _w?: number };
      delete rest._w;
      return rest as DimensionRow;
    })
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, limit);
}

/**
 * Sums the ecommerce funnel across sites. Returns null when no successful site
 * reported a funnel, so the section is hidden rather than shown empty.
 */
export function aggregateFunnel(properties: PropertyReport[]): EcommerceFunnel | null {
  let any = false;
  const total: EcommerceFunnel = {
    itemsViewed: 0,
    itemsAddedToCart: 0,
    itemsCheckedOut: 0,
    itemsPurchased: 0,
  };
  for (const p of properties) {
    if (p.status !== "ok" || !p.funnel) continue;
    any = true;
    total.itemsViewed += p.funnel.itemsViewed;
    total.itemsAddedToCart += p.funnel.itemsAddedToCart;
    total.itemsCheckedOut += p.funnel.itemsCheckedOut;
    total.itemsPurchased += p.funnel.itemsPurchased;
  }
  return any ? total : null;
}

export type Granularity = "daily" | "weekly" | "monthly";

/** Aggregate a daily trend into weekly (ISO Monday buckets) or monthly points. */
export function bucketTrend(points: TrendPoint[], granularity: Granularity): TrendPoint[] {
  if (granularity === "daily") return points;
  const map = new Map<string, TrendPoint>();
  for (const t of points) {
    const y = +t.date.slice(0, 4);
    const m = +t.date.slice(4, 6);
    const d = +t.date.slice(6, 8);
    let bucket: string;
    if (granularity === "monthly") {
      bucket = t.date.slice(0, 6) + "01";
    } else {
      const date = new Date(Date.UTC(y, m - 1, d));
      const day = date.getUTCDay(); // 0 = Sunday
      const diff = (day + 6) % 7; // days since Monday
      date.setUTCDate(date.getUTCDate() - diff);
      bucket = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
        date.getUTCDate()
      ).padStart(2, "0")}`;
    }
    const cur = map.get(bucket) ?? { date: bucket, activeUsers: 0, sessions: 0 };
    cur.activeUsers += t.activeUsers;
    cur.sessions += t.sessions;
    map.set(bucket, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
