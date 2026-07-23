import type { CompareMode, DateRange, PresetId, RangeSelection } from "./types";

const DAY_MS = 86_400_000;

export function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function addDays(iso: string, days: number): string {
  return toIso(new Date(parseIso(iso).getTime() + days * DAY_MS));
}

export function rangeLengthDays(range: DateRange): number {
  return (
    Math.round(
      (parseIso(range.endDate).getTime() - parseIso(range.startDate).getTime()) / DAY_MS
    ) + 1
  );
}

/** Resolve a preset selection into a concrete date range. `today` is injectable for tests. */
export function resolveRange(sel: RangeSelection, today = new Date()): DateRange {
  const t = toIso(today);
  const startOfMonth = t.slice(0, 8) + "01";
  switch (sel.preset) {
    case "today":
      return { startDate: t, endDate: t };
    case "yesterday": {
      const y = addDays(t, -1);
      return { startDate: y, endDate: y };
    }
    case "last7": {
      // Rolling windows end yesterday: today's data is still incomplete in GA4.
      const end = addDays(t, -1);
      return { startDate: addDays(end, -6), endDate: end };
    }
    case "last30": {
      const end = addDays(t, -1);
      return { startDate: addDays(end, -29), endDate: end };
    }
    case "thisMonth":
      return { startDate: startOfMonth, endDate: t };
    case "lastMonth": {
      const endPrev = addDays(startOfMonth, -1);
      return { startDate: endPrev.slice(0, 8) + "01", endDate: endPrev };
    }
    case "custom": {
      const start = sel.start ?? addDays(t, -29);
      const end = sel.end ?? t;
      return start <= end
        ? { startDate: start, endDate: end }
        : { startDate: end, endDate: start };
    }
  }
}

/** The equivalent period immediately before the given range (same length). */
export function previousPeriod(range: DateRange): DateRange {
  const len = rangeLengthDays(range);
  const end = addDays(range.startDate, -1);
  return { startDate: addDays(end, -(len - 1)), endDate: end };
}

/** The same calendar dates one year earlier. */
export function previousYear(range: DateRange): DateRange {
  const shift = (iso: string) => {
    const d = parseIso(iso);
    const target = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
    // Handle Feb 29 -> Feb 28
    if (target.getUTCMonth() !== d.getUTCMonth()) target.setUTCDate(0);
    return toIso(target);
  };
  return { startDate: shift(range.startDate), endDate: shift(range.endDate) };
}

export function compareRangeFor(range: DateRange, mode: CompareMode): DateRange | undefined {
  if (mode === "previous_period") return previousPeriod(range);
  if (mode === "previous_year") return previousYear(range);
  return undefined;
}

export const PRESET_LABELS: Record<PresetId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Previous month",
  custom: "Custom range",
};

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseIso(s);
  return !Number.isNaN(d.getTime()) && toIso(d) === s;
}
