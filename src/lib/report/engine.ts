import { globalCache } from "../cache";
import { mapWithLimit } from "../concurrency";
import { compareRangeFor } from "../dateRanges";
import { listAccountSummaries } from "../google/adminApi";
import { runPropertyReport } from "../google/dataApi";
import { GoogleApiError } from "../google/errors";
import type {
  CompareMode,
  DateRange,
  PropertyReport,
  PropertySummary,
  ReportResponse,
} from "../types";

/**
 * Fans out report generation across the selected properties with:
 *  - bounded concurrency (3 at a time) to stay inside Google API quotas,
 *  - short-term caching so repeated clicks do not re-query Google,
 *  - per-property failure isolation: one failing property never discards the
 *    rest of the report.
 */

const REPORT_TTL_MS = 5 * 60 * 1000;
const reportCache = globalCache<PropertyReport>("propertyReport", REPORT_TTL_MS);

function cacheKey(userKey: string, propertyId: string, range: DateRange, compare: CompareMode) {
  return [userKey, propertyId, range.startDate, range.endDate, compare].join("|");
}

export async function generateReport(opts: {
  accessToken: string;
  userKey: string;
  propertyIds: string[];
  range: DateRange;
  compare: CompareMode;
}): Promise<ReportResponse> {
  const { accessToken, userKey, propertyIds, range, compare } = opts;

  // Resolve display names/metadata from the (cached) account summaries.
  const index = new Map<string, PropertySummary>();
  try {
    const summaries = await listAccountSummaries(accessToken, userKey);
    for (const acc of summaries.accounts) {
      for (const p of acc.properties) index.set(p.propertyId, p);
    }
  } catch {
    // Names fall back to IDs below; per-property calls surface real errors.
  }

  const properties = await mapWithLimit(propertyIds, 3, async (propertyId) => {
    const key = cacheKey(userKey, propertyId, range, compare);
    const cached = reportCache.get(key);
    if (cached) return cached;

    const summary: PropertySummary = index.get(propertyId) ?? {
      propertyId,
      propertyName: `Property ${propertyId}`,
      accountId: "",
      accountName: "Unknown account",
    };

    try {
      const report = await runPropertyReport(summary, accessToken, range, compare);
      reportCache.set(key, report);
      return report;
    } catch (err) {
      const detail =
        err instanceof GoogleApiError
          ? err.detail
          : {
              code: "network" as const,
              message: "Could not reach Google Analytics. Check your connection and retry.",
              retryable: true,
            };
      const failed: PropertyReport = {
        propertyId,
        propertyName: summary.propertyName,
        accountName: summary.accountName,
        currencyCode: summary.currencyCode ?? "USD",
        timeZone: summary.timeZone ?? "UTC",
        status: "error",
        hasRevenue: false,
        noData: false,
        error: detail,
      };
      return failed;
    }
  });

  return {
    demo: false,
    generatedAt: new Date().toISOString(),
    range,
    compare,
    compareRange: compareRangeFor(range, compare),
    properties,
  };
}
