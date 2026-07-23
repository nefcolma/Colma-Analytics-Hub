"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bucketTrend, type Granularity } from "@/lib/report/aggregate";
import { fmtCompact, fmtGaDate, fmtInt } from "@/lib/format";
import type { TrendPoint } from "@/lib/types";

const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const NAVY = "#2c4a7c";
const AMBER = "#c96a11";

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const data = bucketTrend(points, granularity).map((p) => ({
    ...p,
    label:
      granularity === "monthly"
        ? new Date(
            Date.UTC(+p.date.slice(0, 4), +p.date.slice(4, 6) - 1, 1)
          ).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
        : fmtGaDate(p.date),
  }));

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div role="group" aria-label="Trend granularity" className="inline-flex rounded-md border border-line-strong p-0.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={granularity === g.id}
              onClick={() => setGranularity(g.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                granularity === g.id ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AMBER} stopOpacity={0.25} />
                <stop offset="100%" stopColor={AMBER} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NAVY} stopOpacity={0.2} />
                <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e6e4dc" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6f7480" }}
              tickLine={false}
              axisLine={{ stroke: "#e6e4dc" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6f7480" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmtCompact(v)}
              width={44}
            />
            <Tooltip
              formatter={(value) => fmtInt(Number(value))}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e6e4dc",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke={NAVY}
              strokeWidth={2}
              fill="url(#fillSessions)"
            />
            <Area
              type="monotone"
              dataKey="activeUsers"
              name="Active users"
              stroke={AMBER}
              strokeWidth={2}
              fill="url(#fillUsers)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
