"use client";

import {
  fmtChange,
  fmtCompact,
  fmtCurrency,
  fmtDuration,
  fmtIsoDate,
  fmtRate,
  pctChange,
} from "@/lib/format";
import type { AggregatedKpis } from "@/lib/report/aggregate";
import type { DateRange, KpiSet } from "@/lib/types";
import { Card } from "@/components/ui/primitives";

function ChangeIndicator({
  change,
  compareRange,
}: {
  change: number | null;
  compareRange?: DateRange;
}) {
  if (!compareRange) return null;
  const tone =
    change === null || Math.abs(change) < 0.0005
      ? "text-muted"
      : change > 0
        ? "text-positive"
        : "text-negative";
  const arrow = change === null || Math.abs(change) < 0.0005 ? "–" : change > 0 ? "▲" : "▼";
  return (
    <p className={`mt-1.5 flex items-center gap-1 text-xs ${tone}`}>
      <span aria-hidden>{arrow}</span>
      <span>{change === null ? "New" : fmtChange(change)}</span>
      <span className="text-muted">
        vs {fmtIsoDate(compareRange.startDate)} – {fmtIsoDate(compareRange.endDate)}
      </span>
    </p>
  );
}

function KpiCard({
  label,
  value,
  change,
  compareRange,
}: {
  label: string;
  value: string;
  change: number | null;
  compareRange?: DateRange;
}) {
  return (
    <Card className="border-t-2 border-t-accent/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <ChangeIndicator change={change} compareRange={compareRange} />
    </Card>
  );
}

export function KpiGrid({
  kpis,
  compareRange,
}: {
  kpis: AggregatedKpis;
  compareRange?: DateRange;
}) {
  const { current, previous, revenue } = kpis;
  const chg = (pick: (k: KpiSet) => number) =>
    pctChange(pick(current), previous ? pick(previous) : undefined);

  const cards = [
    { label: "Active users", value: fmtCompact(current.activeUsers), change: chg((k) => k.activeUsers) },
    { label: "New users", value: fmtCompact(current.newUsers), change: chg((k) => k.newUsers) },
    { label: "Sessions", value: fmtCompact(current.sessions), change: chg((k) => k.sessions) },
    { label: "Views", value: fmtCompact(current.views), change: chg((k) => k.views) },
    { label: "Engagement rate", value: fmtRate(current.engagementRate), change: chg((k) => k.engagementRate) },
    {
      label: "Avg. session duration",
      value: fmtDuration(current.averageSessionDuration),
      change: chg((k) => k.averageSessionDuration),
    },
    { label: "Key events", value: fmtCompact(current.keyEvents), change: chg((k) => k.keyEvents) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} compareRange={compareRange} />
      ))}
      {revenue.anyRevenue ? (
        <KpiCard
          label="Total revenue"
          value={fmtCurrency(current.totalRevenue, revenue.currency)}
          change={chg((k) => k.totalRevenue)}
          compareRange={compareRange}
        />
      ) : null}
    </div>
  );
}
