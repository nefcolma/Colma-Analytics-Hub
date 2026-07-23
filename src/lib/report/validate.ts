import { isValidIsoDate, rangeLengthDays } from "../dateRanges";
import type { CompareMode, ReportRequest } from "../types";

export const MAX_PROPERTIES = 25;
export const MAX_RANGE_DAYS = 400;
const COMPARE_MODES: CompareMode[] = ["none", "previous_period", "previous_year"];

export type ValidationResult =
  | { ok: true; value: Required<Pick<ReportRequest, "propertyIds" | "range" | "compare" | "demo">> }
  | { ok: false; message: string };

/**
 * Validates an incoming report request. Kept separate from the route handler so
 * the rules can be exercised directly in tests.
 */
export function validateReportRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid request body." };
  }
  const b = body as Partial<ReportRequest>;

  if (!Array.isArray(b.propertyIds) || b.propertyIds.length === 0) {
    return { ok: false, message: "Select at least one property." };
  }
  if (b.propertyIds.length > MAX_PROPERTIES) {
    return { ok: false, message: `Select up to ${MAX_PROPERTIES} properties per report.` };
  }
  if (!b.propertyIds.every((id) => typeof id === "string" && /^\d{1,16}$/.test(id))) {
    return { ok: false, message: "Property IDs must be numeric." };
  }

  const range = b.range;
  if (!range || !isValidIsoDate(range.startDate) || !isValidIsoDate(range.endDate)) {
    return { ok: false, message: "Provide a valid date range (YYYY-MM-DD)." };
  }
  if (range.startDate > range.endDate) {
    return { ok: false, message: "The start date must be on or before the end date." };
  }
  if (rangeLengthDays(range) > MAX_RANGE_DAYS) {
    return { ok: false, message: `Date ranges are limited to ${MAX_RANGE_DAYS} days.` };
  }

  const compare = (b.compare ?? "none") as CompareMode;
  if (!COMPARE_MODES.includes(compare)) {
    return { ok: false, message: "Unknown comparison mode." };
  }

  return {
    ok: true,
    value: {
      propertyIds: [...new Set(b.propertyIds)],
      range: { startDate: range.startDate, endDate: range.endDate },
      compare,
      demo: b.demo === true,
    },
  };
}
