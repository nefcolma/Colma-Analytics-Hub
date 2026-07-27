"use client";

import { fmtInt, fmtRate } from "@/lib/format";
import type { DimensionRow } from "@/lib/types";

/**
 * New vs returning active users. GA4 reports the split under the
 * `newVsReturning` dimension ("new" / "returning", plus a blank bucket we drop).
 */
export function NewReturningChart({ rows }: { rows: DimensionRow[] }) {
  const newUsers = rows.find((r) => r.key === "new")?.activeUsers ?? 0;
  const returning = rows.find((r) => r.key === "returning")?.activeUsers ?? 0;
  const total = newUsers + returning;

  const bars = [
    { label: "New", value: newUsers, color: "#c96a11" },
    { label: "Returning", value: returning, color: "#2c4a7c" },
  ];

  return (
    <div className="space-y-4 p-5">
      {bars.map((b) => {
        const pct = total > 0 ? b.value / total : 0;
        return (
          <div key={b.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                {b.label}
              </span>
              <span className="tabular">
                <span className="font-semibold">{fmtInt(b.value)}</span>{" "}
                <span className="text-xs text-muted">{total > 0 ? fmtRate(pct) : "–"}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, pct * 100)}%`, backgroundColor: b.color }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted">
        Share of active users who are first-time vs returning in this period.
      </p>
    </div>
  );
}
