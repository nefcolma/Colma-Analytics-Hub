"use client";

import { useMemo } from "react";
import { useReport } from "@/components/report-context";
import { ConnectCard } from "@/components/ConnectCard";
import { DataTable } from "@/components/tables/DataTable";
import {
  BlockSkeleton,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoBadge,
  EmptyState,
} from "@/components/ui/primitives";
import { fmtCurrency, fmtInt } from "@/lib/format";
import { analyzeTracking, summarizeTracking, type SiteTracking } from "@/lib/report/tracking";

const TONE: Record<SiteTracking["severity"], "positive" | "negative" | "neutral" | "warn"> = {
  critical: "negative",
  warning: "warn",
  ok: "positive",
  no_data: "neutral",
  failed: "neutral",
};

const LABEL: Record<SiteTracking["severity"], string> = {
  critical: "Not tracked",
  warning: "Partial",
  ok: "Tracked",
  no_data: "No traffic",
  failed: "Failed",
};

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "bad" | "warn" }) {
  const color =
    tone === "bad" ? "text-negative" : tone === "warn" ? "text-accent-strong" : "text-ink";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`tabular mt-1.5 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
    </Card>
  );
}

export default function TrackingPage() {
  const {
    configLoaded,
    connected,
    demo,
    report,
    reportStatus,
    generate,
    properties,
    selected,
  } = useReport();

  const rows = useMemo(() => (report ? analyzeTracking(report.properties) : []), [report]);
  const stats = useMemo(() => summarizeTracking(rows), [rows]);

  if (!configLoaded) return <BlockSkeleton />;

  if (!demo && !connected) {
    return (
      <div className="py-10">
        <ConnectCard />
      </div>
    );
  }

  const unchecked = properties.length - rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Tracking health</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted">
            Which sites report traffic but no ecommerce data — so you can tell a genuinely quiet
            storefront from one whose GA4 tags are broken.
          </p>
        </div>
        {report?.demo ? <DemoBadge /> : null}
      </div>

      {reportStatus === "loading" && !report ? <BlockSkeleton /> : null}

      {!report && reportStatus !== "loading" ? (
        <EmptyState
          title="No report yet"
          body="Tracking health is read from the sites in the current report. Select the sites you want to audit — all of them, ideally — then generate a report."
          action={
            <Button variant="primary" onClick={() => void generate()} disabled={selected.length === 0}>
              Generate report
            </Button>
          }
        />
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              label="Not tracked"
              value={fmtInt(stats.critical)}
              tone={stats.critical > 0 ? "bad" : undefined}
            />
            <StatTile
              label="Partial"
              value={fmtInt(stats.warning)}
              tone={stats.warning > 0 ? "warn" : undefined}
            />
            <StatTile label="Tracked" value={fmtInt(stats.ok)} />
            <StatTile
              label="Sessions measured blind"
              value={fmtInt(stats.sessionsAtRisk)}
              tone={stats.sessionsAtRisk > 0 ? "bad" : undefined}
            />
          </div>

          {unchecked > 0 ? (
            <p className="text-xs text-muted">
              Showing the {rows.length} {rows.length === 1 ? "site" : "sites"} in the current
              report. {unchecked} more {unchecked === 1 ? "site is" : "sites are"} not included —
              select every site in the header and generate again for a full audit.
            </p>
          ) : null}

          <Card>
            <CardHeader
              title="Sites by tracking status"
              subtitle="Broken sites first, busiest first within each group"
            />
            <DataTable<SiteTracking>
              rows={rows}
              rowKey={(r) => r.propertyId}
              columns={[
                {
                  id: "site",
                  label: "Site",
                  value: (r) => r.propertyName,
                  render: (r) => (
                    <span className="block max-w-64">
                      <span className="block truncate font-medium">{r.propertyName}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {r.accountName} · <span className="font-mono">{r.propertyId}</span>
                      </span>
                    </span>
                  ),
                },
                {
                  id: "severity",
                  label: "Status",
                  value: (r) => r.severity,
                  render: (r) => <Chip tone={TONE[r.severity]}>{LABEL[r.severity]}</Chip>,
                },
                {
                  id: "sessions",
                  label: "Sessions",
                  align: "right",
                  value: (r) => r.sessions,
                  render: (r) => fmtInt(r.sessions),
                },
                {
                  id: "revenue",
                  label: "Revenue",
                  align: "right",
                  value: (r) => r.revenue,
                  render: (r) => fmtCurrency(r.revenue, r.currencyCode),
                },
                {
                  id: "diagnosis",
                  label: "What the data shows",
                  sortable: false,
                  value: (r) => r.summary,
                  render: (r) => (
                    <span className="block max-w-96">
                      <span className="block">{r.summary}</span>
                      {r.action ? (
                        <span className="mt-0.5 block text-[11px] text-muted">{r.action}</span>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          <p className="text-xs text-muted">
            These are inferences, not proof: a storefront with real traffic and genuinely no orders
            looks the same as one whose purchase event is broken. Treat each flag as worth a check.
          </p>
        </>
      ) : null}
    </div>
  );
}
