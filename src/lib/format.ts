/** Number/date formatting used across the UI and exports. */

const int = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function fmtInt(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "–";
  return int.format(Math.round(n));
}

export function fmtCompact(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "–";
  return Math.abs(n) >= 10000 ? compact.format(n) : int.format(Math.round(n));
}

/** rate is a fraction 0..1 */
export function fmtRate(rate: number | undefined | null): string {
  if (rate === undefined || rate === null || Number.isNaN(rate)) return "–";
  return `${(rate * 100).toFixed(1)}%`;
}

export function fmtDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "–";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  if (m === 0) return `${rest}s`;
  return `${m}m ${String(rest).padStart(2, "0")}s`;
}

export function fmtCurrency(n: number | undefined | null, code?: string): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "–";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code || "USD",
      maximumFractionDigits: n >= 1000 ? 0 : 2,
    }).format(n);
  } catch {
    return `${int.format(Math.round(n))} ${code ?? ""}`.trim();
  }
}

/** Percentage change between current and previous. Returns null when undefined (prev = 0). */
export function pctChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

export function fmtChange(change: number | null): string {
  if (change === null) return "–";
  const sign = change > 0 ? "+" : "";
  return `${sign}${(change * 100).toFixed(1)}%`;
}

/** "20260701" -> "Jul 1" */
export function fmtGaDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  const d = new Date(
    Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8))
  );
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
