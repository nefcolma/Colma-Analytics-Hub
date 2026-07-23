"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtInt, fmtRate } from "@/lib/format";
import type { DimensionRow } from "@/lib/types";

const COLORS: Record<string, string> = {
  desktop: "#2c4a7c",
  mobile: "#c96a11",
  tablet: "#8a94a8",
};

export function DevicesChart({ rows }: { rows: DimensionRow[] }) {
  const total = rows.reduce((s, r) => s + (r.activeUsers ?? 0), 0);
  const data = rows.map((r) => ({
    name: r.key,
    value: r.activeUsers ?? 0,
    sessions: r.sessions ?? 0,
  }));

  return (
    <div className="flex items-center gap-6">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={COLORS[d.name] ?? "#c9ccd4"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => fmtInt(Number(value))}
              contentStyle={{ borderRadius: 8, border: "1px solid #e6e4dc", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-2.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[d.name] ?? "#c9ccd4" }}
            />
            <span className="capitalize">{d.name}</span>
            <span className="ml-auto tabular font-medium">{fmtInt(d.value)}</span>
            <span className="tabular w-14 text-right text-xs text-muted">
              {total > 0 ? fmtRate(d.value / total) : "–"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
