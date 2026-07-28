"use client";

import {
  conversionRate,
  fmtChange,
  fmtCompact,
  fmtConversionRate,
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
  onClick,
}: {
  label: string;
  value: string;
  change: number | null;
  compareRange?: DateRange;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {onClick ? (
          <span className="inline-flex items-center gap-0.5 text-accent-strong">
            <span aria-hidden>·</span> by site
            <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        ) : null}
      </p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <ChangeIndicator change={change} compareRange={compareRange} />
    </>
  );

  if (onClick) {
    return (
      <Card className="border-t-2 border-t-accent/60 p-0">
        <button
          type="button"
          onClick={onClick}
          className="block w-full rounded-lg p-4 text-left transition-colors hover:bg-paper/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {body}
        </button>
      </Card>
    );
  }

  return <Card className="border-t-2 border-t-accent/60 p-4">{body}</Card>;
}

export function KpiGrid({
  kpis,
  compareRange,
  onRevenueClick,
}: {
  kpis: AggregatedKpis;
  compareRange?: DateRange;
  onRevenueClick?: () => void;
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
    {
      label: "Conversion rate",
      value: fmtConversionRate(conversionRate(current.keyEvents, current.sessions)),
      // Rate of the combined totals, not an average of per-site rates, so busy
      // sites carry the weight they should.
      change: chg((k) => conversionRate(k.keyEvents, k.sessions)),
    },
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
          onClick={onRevenueClick}
        />
      ) : null}
    </div>
  );
}
