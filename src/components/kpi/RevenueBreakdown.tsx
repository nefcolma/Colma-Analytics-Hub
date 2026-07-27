"use client";

import { useEffect, useMemo } from "react";
import { fmtCurrency, fmtIsoDate } from "@/lib/format";
import type { DateRange, PropertyReport } from "@/lib/types";

/**
 * Modal breakdown of Total Revenue by site. The aggregate KPI is a straight sum
 * across sites; this lists which sites contributed it (largest first) with each
 * site's share. Data comes straight from the report — no extra API calls.
 */
export function RevenueBreakdown({
  properties,
  range,
  onClose,
}: {
  properties: PropertyReport[];
  range: DateRange;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const rows = useMemo(
    () =>
      properties
        .filter((p) => p.status === "ok" && p.hasRevenue && (p.kpis?.current.totalRevenue ?? 0) > 0)
        .map((p) => ({
          id: p.propertyId,
          name: p.propertyName,
          account: p.accountName,
          currency: p.currencyCode,
          revenue: p.kpis!.current.totalRevenue,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    [properties]
  );

  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const currencies = [...new Set(rows.map((r) => r.currency))];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revenue by site"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-ink/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Revenue by site</h2>
            <p className="mt-0.5 text-xs text-muted">
              {fmtIsoDate(range.startDate)} – {fmtIsoDate(range.endDate)} · {rows.length}{" "}
              {rows.length === 1 ? "site" : "sites"} with revenue
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted">
              No site reported revenue in this period.
            </p>
          ) : (
            rows.map((r) => {
              const pct = total > 0 ? r.revenue / total : 0;
              return (
                <div key={r.id} className="rounded-md px-3 py-2 hover:bg-paper/60">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {fmtCurrency(r.revenue, r.currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(2, pct * 100)}%` }}
                      />
                    </div>
                    <span className="tabular w-12 shrink-0 text-right text-[11px] text-muted">
                      {(pct * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">{r.account}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-line px-5 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Total</span>
            <span className="tabular font-semibold">{fmtCurrency(total, rows[0]?.currency)}</span>
          </div>
          {currencies.length > 1 ? (
            <p className="mt-1.5 text-[11px] text-accent-strong">
              Sites report in multiple currencies ({currencies.join(", ")}); the total is a raw sum
              without conversion.
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] text-muted">
            Gross revenue measured by Analytics — before withheld taxes or other business costs.
          </p>
        </div>
      </div>
    </div>
  );
}
