import type { PropertyReport, PropertySummary } from "../types";

/**
 * Client-side batching for report generation.
 *
 * Each site costs three Google Analytics calls, and a single Cloudflare Worker
 * request is capped at ~50 subrequests on the free plan. Rather than send every
 * selected site in one request (which fails past ~16 sites), the client splits
 * the selection into batches and issues one request per batch. These helpers
 * are pure so the splitting/merging is unit-tested independently of fetch.
 */

/**
 * Max sites per report request. 12 × 3 Analytics calls = 36 subrequests, plus
 * the account-summary call — comfortably under the free-plan limit with room
 * left for retries. Keep this in step with the number of batchRunReports calls
 * in runPropertyReport: sites × calls must stay well below 50.
 */
export const REPORT_CHUNK_SIZE = 12;

/** How many batches to run at once — small, to stay gentle on Google's quota. */
export const REPORT_CHUNK_CONCURRENCY = 2;

/** Splits `items` into consecutive chunks of at most `size` (size ≥ 1). */
export function chunk<T>(items: T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

/** A placeholder "failed" report for a site whose batch could not be generated,
 *  so a dropped batch surfaces as a retryable failure instead of vanishing. */
export function syntheticErrorReport(id: string, summary?: PropertySummary): PropertyReport {
  return {
    propertyId: id,
    propertyName: summary?.propertyName ?? `Site ${id}`,
    accountName: summary?.accountName ?? "Unknown account",
    currencyCode: summary?.currencyCode ?? "USD",
    timeZone: summary?.timeZone ?? "UTC",
    status: "error",
    hasRevenue: false,
    noData: false,
    error: {
      code: "unknown",
      message: "This batch could not be generated. Retry to try again.",
      retryable: true,
    },
  };
}

/**
 * Orders the collected per-site reports to match the original selection. Any id
 * with no report (its batch failed) is filled with a synthetic error so the
 * merged report always covers every requested site, in the requested order.
 */
export function orderReports(
  ids: string[],
  reports: PropertyReport[],
  summaries: Map<string, PropertySummary>
): PropertyReport[] {
  const byId = new Map(reports.map((p) => [p.propertyId, p]));
  return ids.map((id) => byId.get(id) ?? syntheticErrorReport(id, summaries.get(id)));
}
