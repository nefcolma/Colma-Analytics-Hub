"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReport } from "@/components/report-context";
import { Button } from "@/components/ui/primitives";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { DataTable } from "@/components/tables/DataTable";
import { aggregateKpis, aggregateRows } from "@/lib/report/aggregate";
import { fmtInt, fmtIsoDate, fmtRate } from "@/lib/format";
import type { DimensionRow } from "@/lib/types";

function Section({ title, rows, metric }: { title: string; rows: DimensionRow[]; metric: "sessions" | "views" | "activeUsers" }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 font-display text-lg tracking-tight">{title}</h2>
      <DataTable
        dense
        rows={rows.slice(0, 10)}
        rowKey={(r) => r.key}
        initialSort={{ id: metric, desc: true }}
        columns={[
          { id: "key", label: "Name", value: (r) => r.key },
          { id: metric, label: metric === "views" ? "Views" : metric === "sessions" ? "Sessions" : "Active users", align: "right", value: (r) => r[metric], render: (r) => fmtInt(r[metric]) },
          { id: "engagementRate", label: "Engagement", align: "right", value: (r) => r.engagementRate, render: (r) => fmtRate(r.engagementRate) },
        ]}
      />
    </section>
  );
}

export default function PrintPage() {
  const { report } = useReport();

  const ok = useMemo(() => (report ? report.properties.filter((p) => p.status === "ok") : []), [report]);
  const kpis = useMemo(() => (report ? aggregateKpis(report.properties) : null), [report]);
  const channels = useMemo(() => aggregateRows(ok, (p) => p.channels, 10), [ok]);
  const topPages = useMemo(() => aggregateRows(ok, (p) => p.topPages, 10), [ok]);
  const landingPages = useMemo(() => aggregateRows(ok, (p) => p.landingPages, 10), [ok]);
  const geography = useMemo(() => aggregateRows(ok, (p) => p.geography, 10), [ok]);

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-xl">No report loaded</h1>
        <p className="mt-2 text-sm text-muted">
          Generate a report first, then reopen this print view.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-accent-strong underline">
          Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/exports" className="text-sm text-accent-strong underline">
          Back to exports
        </Link>
        <Button variant="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <header className="border-b border-line pb-4">
        <h1 className="font-display text-2xl tracking-tight">Colma Analytics Hub — Report</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
          <div>
            <dt className="inline font-medium">Date range: </dt>
            <dd className="inline">
              {fmtIsoDate(report.range.startDate)} – {fmtIsoDate(report.range.endDate)}
            </dd>
          </div>
          {report.compareRange ? (
            <div>
              <dt className="inline font-medium">Compared to: </dt>
              <dd className="inline">
                {fmtIsoDate(report.compareRange.startDate)} – {fmtIsoDate(report.compareRange.endDate)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="inline font-medium">Generated: </dt>
            <dd className="inline">
              {new Date(report.generatedAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Sites: </dt>
            <dd className="inline">
              {ok.length} of {report.properties.length} reporting
            </dd>
          </div>
        </dl>
        {report.demo ? (
          <p className="mt-3 inline-block rounded border border-accent/40 bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">
            Demo data — these figures are generated samples, not real Analytics measurements.
          </p>
        ) : null}
      </header>

      {kpis ? (
        <section className="mt-6">
          <KpiGrid kpis={kpis} compareRange={report.compareRange} />
        </section>
      ) : null}

      <Section title="Traffic acquisition" rows={channels} metric="sessions" />
      <Section title="Top pages" rows={topPages} metric="views" />
      <Section title="Landing pages" rows={landingPages} metric="sessions" />
      <Section title="Geography" rows={geography} metric="activeUsers" />

      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-2 font-display text-lg tracking-tight">Sites included</h2>
        <ul className="space-y-1 text-xs text-muted">
          {report.properties.map((p) => (
            <li key={p.propertyId}>
              <span className="font-medium text-ink">{p.propertyName}</span> · {p.accountName} ·{" "}
              <span className="font-mono">{p.propertyId}</span> · {p.timeZone}
              {p.status === "error" ? ` — failed: ${p.error?.message ?? "unknown error"}` : ""}
              {p.noData ? " — no data in this period" : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
