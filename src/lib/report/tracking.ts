import type { PropertyReport } from "../types";

/**
 * Ecommerce tracking health.
 *
 * Across many sites it is easy for one storefront to lose its GA4 ecommerce
 * tags and quietly report traffic with no sales — the numbers still look
 * plausible, so nobody notices. This module reads the report we already have
 * and names the specific instrumentation gap per site, so the fix is obvious.
 *
 * It only ever *infers*: a site with real traffic and genuinely no orders looks
 * the same as one whose purchase event is broken. Diagnoses are therefore
 * phrased as what the data shows, and every one is worth a human check.
 */

export type TrackingSeverity = "critical" | "warning" | "ok" | "no_data" | "failed";

export type SiteTracking = {
  propertyId: string;
  propertyName: string;
  accountName: string;
  sessions: number;
  revenue: number;
  currencyCode: string;
  severity: TrackingSeverity;
  /** What the data shows. */
  summary: string;
  /** The concrete fix, when there is one. */
  action?: string;
};

export type TrackingSummary = {
  critical: number;
  warning: number;
  ok: number;
  noData: number;
  failed: number;
  /** Sessions on sites with a critical gap — the traffic being measured blind. */
  sessionsAtRisk: number;
};

const SEVERITY_ORDER: Record<TrackingSeverity, number> = {
  critical: 0,
  warning: 1,
  no_data: 2,
  failed: 3,
  ok: 4,
};

function diagnose(p: PropertyReport): Pick<SiteTracking, "severity" | "summary" | "action"> {
  if (p.status === "error") {
    return {
      severity: "failed",
      summary: p.error?.message ?? "The report failed for this site.",
      action: "Retry the report; tracking cannot be checked until it succeeds.",
    };
  }

  const sessions = p.kpis?.current.sessions ?? 0;
  if (sessions === 0) {
    return {
      severity: "no_data",
      summary: "No traffic in this period, so tracking cannot be assessed.",
      action: "Widen the date range, or confirm the GA4 tag is installed at all.",
    };
  }

  const revenue = p.kpis?.current.totalRevenue ?? 0;
  const viewed = p.funnel?.itemsViewed ?? 0;
  const addedToCart = p.funnel?.itemsAddedToCart ?? 0;
  const checkedOut = p.funnel?.itemsCheckedOut ?? 0;
  const purchased = p.funnel?.itemsPurchased ?? 0;
  const hasProducts = (p.products?.length ?? 0) > 0;
  const hasAnySignal =
    revenue > 0 || viewed + addedToCart + checkedOut + purchased > 0 || hasProducts;

  // Nothing at all: the ecommerce layer is almost certainly not installed.
  if (!hasAnySignal) {
    return {
      severity: "critical",
      summary: "Traffic, but no ecommerce events of any kind.",
      action:
        "Add the GA4 ecommerce events (view_item, add_to_cart, begin_checkout, purchase) to this storefront.",
    };
  }

  // Shoppers reach checkout but nothing is ever recorded as bought.
  if (checkedOut > 0 && purchased === 0 && revenue === 0) {
    return {
      severity: "critical",
      summary: "Checkouts are tracked, but no purchases or revenue.",
      action: "Check that the purchase event fires on the order-confirmation page.",
    };
  }

  // Revenue arrives without item detail: purchase fires without its items array.
  if (revenue > 0 && purchased === 0) {
    return {
      severity: "warning",
      summary: "Revenue is tracked, but no items are attached to it.",
      action: "Include the items array in the purchase event so product reports work.",
    };
  }

  // Items sold but no money: purchase fires without value/currency.
  if (purchased > 0 && revenue === 0) {
    return {
      severity: "warning",
      summary: "Purchases are tracked, but carry no revenue value.",
      action: "Send value and currency with the purchase event.",
    };
  }

  // Partial funnel: a middle step is missing.
  if (addedToCart > 0 && checkedOut === 0) {
    return {
      severity: "warning",
      summary: "Add-to-carts are tracked, but no checkouts.",
      action: "Add the begin_checkout event when the checkout page loads.",
    };
  }
  if (viewed > 0 && addedToCart === 0) {
    return {
      severity: "warning",
      summary: "Product views are tracked, but no add-to-carts.",
      action: "Add the add_to_cart event to the add-to-cart button.",
    };
  }

  if (revenue > 0 && purchased > 0) {
    return { severity: "ok", summary: "Purchases and revenue are tracked." };
  }

  // Some ecommerce signal, but the funnel never reaches a sale.
  return {
    severity: "warning",
    summary: "Ecommerce events are partially tracked; no completed purchases.",
    action: "Confirm the full funnel fires: view_item → add_to_cart → begin_checkout → purchase.",
  };
}

/**
 * Diagnoses every site in a report. Critical gaps come first, and within each
 * severity the busiest sites lead — fixing a broken storefront with thousands
 * of sessions is worth more than one with five.
 */
export function analyzeTracking(properties: PropertyReport[]): SiteTracking[] {
  return properties
    .map((p) => ({
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      accountName: p.accountName,
      sessions: p.kpis?.current.sessions ?? 0,
      revenue: p.kpis?.current.totalRevenue ?? 0,
      currencyCode: p.currencyCode,
      ...diagnose(p),
    }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.sessions - a.sessions
    );
}

export function summarizeTracking(rows: SiteTracking[]): TrackingSummary {
  const summary: TrackingSummary = {
    critical: 0,
    warning: 0,
    ok: 0,
    noData: 0,
    failed: 0,
    sessionsAtRisk: 0,
  };
  for (const r of rows) {
    if (r.severity === "critical") {
      summary.critical += 1;
      summary.sessionsAtRisk += r.sessions;
    } else if (r.severity === "warning") summary.warning += 1;
    else if (r.severity === "ok") summary.ok += 1;
    else if (r.severity === "no_data") summary.noData += 1;
    else summary.failed += 1;
  }
  return summary;
}
