"use client";

import { useRouter } from "next/navigation";
import { useReport } from "@/components/report-context";
import { ConnectCard } from "@/components/ConnectCard";
import { PartialFailureBanner } from "@/components/PartialFailureBanner";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { DataTable } from "@/components/tables/DataTable";
import {
  BlockSkeleton,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoBadge,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { fmtChange, fmtCurrency, fmtInt, fmtIsoDate, fmtRate, pctChange } from "@/lib/format";
import type { PropertyReport } from "@/lib/types";

export default function ReportsPage() {
  const router = useRouter();
  const {
    configLoaded,
    connected,
    demo,
    report,
    reportStatus,
    reportError,
    generate,
    setSelected,
  } = useReport();

  if (!configLoaded) return <BlockSkeleton />;

  if (!demo && !connected) {
    return (
      <div className="py-10">
        <ConnectCard />
      </div>
    );
  }

  const openProperty = (propertyId: string) => {
    setSelected([propertyId]);
    void generate([propertyId]);
    router.push("/");
  };

  const change = (p: PropertyReport, pick: (k: NonNullable<PropertyReport["kpis"]>["current"]) => number) => {
    if (!p.kpis?.previous) return null;
    return pctChange(pick(p.kpis.current), pick(p.kpis.previous));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Reports</h1>
          <p className="mt-0.5 text-sm text-muted">
            Consolidated comparison across the sites in the latest report.
          </p>
        </div>
        {report?.demo ? <DemoBadge /> : null}
      </div>

      <AuthErrorBanner />

      {reportStatus === "loading" && !report ? <BlockSkeleton /> : null}

      {reportStatus === "error" && !report ? (
        <ErrorState
          title="Report failed"
          body={reportError?.message ?? "The report could not be generated."}
          onRetry={() => void generate()}
        />
      ) : null}

      {reportStatus !== "loading" && !report ? (
        <EmptyState
          title="No report yet"
          body="Pick sites and a date range in the header, then generate a report to compare sites here."
          action={
            <Button variant="primary" onClick={() => void generate()}>
              Generate report
            </Button>
          }
        />
      ) : null}

      {report ? (
        <>
          <PartialFailureBanner />

          <Card>
            <CardHeader
              title="Site comparison"
              subtitle={`${fmtIsoDate(report.range.startDate)} – ${fmtIsoDate(report.range.endDate)}${
                report.compareRange
                  ? ` · compared to ${fmtIsoDate(report.compareRange.startDate)} – ${fmtIsoDate(
                      report.compareRange.endDate
                    )}`
                  : ""
              }`}
            />
            <DataTable<PropertyReport>
              rows={report.properties}
              rowKey={(p) => p.propertyId}
              initialSort={{ id: "sessions", desc: true }}
              columns={[
                {
                  id: "name",
                  label: "Site",
                  value: (p) => p.propertyName,
                  render: (p) => (
                    <span className="block">
                      <span className="block font-medium">{p.propertyName}</span>
                      <span className="text-[11px] text-muted">
                        {p.accountName} · <span className="font-mono">{p.propertyId}</span> ·{" "}
                        {p.timeZone}
                      </span>
                    </span>
                  ),
                },
                {
                  id: "status",
                  label: "Status",
                  value: (p) => (p.status === "ok" ? (p.noData ? 1 : 2) : 0),
                  render: (p) =>
                    p.status === "error" ? (
                      <Chip tone="negative">Failed</Chip>
                    ) : p.noData ? (
                      <Chip tone="warn">No data</Chip>
                    ) : (
                      <Chip tone="positive">OK</Chip>
                    ),
                },
                {
                  id: "activeUsers",
                  label: "Active users",
                  align: "right",
                  value: (p) => p.kpis?.current.activeUsers,
                  render: (p) => (
                    <span>
                      {fmtInt(p.kpis?.current.activeUsers)}
                      <ChangeNote change={change(p, (k) => k.activeUsers)} />
                    </span>
                  ),
                },
                {
                  id: "sessions",
                  label: "Sessions",
                  align: "right",
                  value: (p) => p.kpis?.current.sessions,
                  render: (p) => (
                    <span>
                      {fmtInt(p.kpis?.current.sessions)}
                      <ChangeNote change={change(p, (k) => k.sessions)} />
                    </span>
                  ),
                },
                {
                  id: "views",
                  label: "Views",
                  align: "right",
                  value: (p) => p.kpis?.current.views,
                  render: (p) => fmtInt(p.kpis?.current.views),
                },
                {
                  id: "engagementRate",
                  label: "Engagement",
                  align: "right",
                  value: (p) => p.kpis?.current.engagementRate,
                  render: (p) => fmtRate(p.kpis?.current.engagementRate),
                },
                {
                  id: "keyEvents",
                  label: "Key events",
                  align: "right",
                  value: (p) => p.kpis?.current.keyEvents,
                  render: (p) => fmtInt(p.kpis?.current.keyEvents),
                },
                {
                  id: "revenue",
                  label: "Revenue",
                  align: "right",
                  value: (p) => (p.hasRevenue ? p.kpis?.current.totalRevenue : undefined),
                  render: (p) =>
                    p.hasRevenue
                      ? fmtCurrency(p.kpis?.current.totalRevenue, p.currencyCode)
                      : "–",
                },
                {
                  id: "open",
                  label: "",
                  sortable: false,
                  value: () => "",
                  render: (p) => (
                    <Button size="sm" onClick={() => openProperty(p.propertyId)}>
                      Open
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          <p className="text-xs text-muted">
            Report generated{" "}
            {new Date(report.generatedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . Each site keeps its own time zone; rates are never summed across sites.
          </p>
        </>
      ) : null}
    </div>
  );
}

function ChangeNote({ change }: { change: number | null }) {
  if (change === null) return null;
  const tone = change > 0 ? "text-positive" : change < 0 ? "text-negative" : "text-muted";
  return <span className={`block text-[11px] ${tone}`}>{fmtChange(change)}</span>;
}
