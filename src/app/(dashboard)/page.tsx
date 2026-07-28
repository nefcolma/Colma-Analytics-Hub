"use client";

import { useMemo, useState } from "react";
import { useReport } from "@/components/report-context";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { ConnectCard } from "@/components/ConnectCard";
import { PartialFailureBanner } from "@/components/PartialFailureBanner";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { RevenueBreakdown } from "@/components/kpi/RevenueBreakdown";
import { TrendChart } from "@/components/charts/TrendChart";
import { DevicesChart } from "@/components/charts/DevicesChart";
import { NewReturningChart } from "@/components/charts/NewReturningChart";
import { FunnelChart } from "@/components/charts/FunnelChart";
import {
  AcquisitionTable,
  GeographyTable,
  LandingPagesTable,
  ProductsTable,
  SearchTermsTable,
  TopPagesTable,
} from "@/components/tables/sectionTables";
import {
  aggregateFunnel,
  aggregateKpis,
  aggregateRows,
  aggregateTrend,
} from "@/lib/report/aggregate";
import { fmtIsoDate } from "@/lib/format";
import {
  BlockSkeleton,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoBadge,
  EmptyState,
  ErrorState,
  KpiSkeletonGrid,
} from "@/components/ui/primitives";

export default function OverviewPage() {
  const {
    configLoaded,
    connected,
    demo,
    propsStatus,
    propsError,
    reloadProperties,
    properties,
    selected,
    report,
    reportStatus,
    reportError,
    generate,
  } = useReport();

  const [revenueOpen, setRevenueOpen] = useState(false);

  const okProperties = useMemo(
    () => (report ? report.properties.filter((p) => p.status === "ok") : []),
    [report]
  );
  const kpis = useMemo(() => (report ? aggregateKpis(report.properties) : null), [report]);
  const trend = useMemo(() => aggregateTrend(okProperties), [okProperties]);
  const channels = useMemo(() => aggregateRows(okProperties, (p) => p.channels, 10), [okProperties]);
  const sourceMedium = useMemo(
    () => aggregateRows(okProperties, (p) => p.sourceMedium, 10),
    [okProperties]
  );
  const topPages = useMemo(() => aggregateRows(okProperties, (p) => p.topPages, 10), [okProperties]);
  const landingPages = useMemo(
    () => aggregateRows(okProperties, (p) => p.landingPages, 10),
    [okProperties]
  );
  const geography = useMemo(() => aggregateRows(okProperties, (p) => p.geography, 10), [okProperties]);
  const devices = useMemo(() => aggregateRows(okProperties, (p) => p.devices, 4), [okProperties]);
  const products = useMemo(
    () => aggregateRows(okProperties, (p) => p.products, 10, (r) => r.revenue ?? 0),
    [okProperties]
  );
  const newVsReturning = useMemo(
    () => aggregateRows(okProperties, (p) => p.newVsReturning, 4),
    [okProperties]
  );
  const searchTerms = useMemo(
    () => aggregateRows(okProperties, (p) => p.searchTerms, 10, (r) => r.events ?? 0),
    [okProperties]
  );
  const funnel = useMemo(() => aggregateFunnel(okProperties), [okProperties]);
  const hasProducts = products.length > 0;
  const hasNewReturning = newVsReturning.some((r) => (r.activeUsers ?? 0) > 0);
  const hasSearchTerms = searchTerms.some((r) => (r.events ?? 0) > 0);
  const revenueCurrency = kpis?.revenue.currency;

  // ---- Interface states ----------------------------------------------------

  if (!configLoaded) {
    return (
      <div className="space-y-4">
        <KpiSkeletonGrid />
        <BlockSkeleton />
      </div>
    );
  }

  if (!demo && !connected) {
    return (
      <div className="py-10">
        <ConnectCard />
      </div>
    );
  }

  if (propsStatus === "error") {
    return (
      <ErrorState
        title="Could not load your Analytics accounts"
        body={propsError?.message ?? "Something went wrong while contacting Google."}
        onRetry={reloadProperties}
      />
    );
  }

  if (propsStatus === "ready" && properties.length === 0) {
    return (
      <EmptyState
        title="No sites available"
        body="The connected Google account does not have access to any GA4 sites. Ask an Analytics administrator to grant Viewer access, then reload."
        action={<Button onClick={reloadProperties}>Reload sites</Button>}
      />
    );
  }

  const loading = propsStatus === "loading" || reportStatus === "loading";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Overview</h1>
          {report ? (
            <p className="mt-0.5 text-sm text-muted">
              {fmtIsoDate(report.range.startDate)} – {fmtIsoDate(report.range.endDate)} ·{" "}
              {okProperties.length} of {report.properties.length}{" "}
              {report.properties.length === 1 ? "site" : "sites"} reporting
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {report?.demo ? <DemoBadge /> : null}
          {okProperties.some((p) => p.noData) ? (
            <Chip tone="neutral">
              {okProperties.filter((p) => p.noData).length} with no data
            </Chip>
          ) : null}
        </div>
      </div>

      <AuthErrorBanner />

      {reportStatus === "error" && !report ? (
        <ErrorState
          title="Report failed"
          body={reportError?.message ?? "The report could not be generated."}
          onRetry={() => void generate()}
        />
      ) : null}

      {selected.length === 0 && !loading && !report ? (
        <EmptyState
          title="Choose sites to begin"
          body="Pick one, several, or all sites from the selector in the header, then generate a report."
        />
      ) : null}

      {loading && !report ? (
        <>
          <KpiSkeletonGrid />
          <BlockSkeleton />
          <BlockSkeleton h="h-48" />
        </>
      ) : null}

      {report ? (
        <>
          <PartialFailureBanner />

          {okProperties.length === 0 ? (
            <ErrorState
              title="No sites could be reported"
              body={report.properties[0]?.error?.message ?? "Every selected site failed."}
              onRetry={() => void generate()}
            />
          ) : okProperties.every((p) => p.noData) ? (
            <EmptyState
              title="No data for this date range"
              body={`The report ran successfully, but ${
                okProperties.length === 1 ? "the selected site" : "every selected site"
              } returned no Analytics data for ${fmtIsoDate(report.range.startDate)} – ${fmtIsoDate(
                report.range.endDate
              )}. Pick a site with recent traffic, widen the date range, or confirm data collection is active in GA4.`}
            />
          ) : (
            <>
              {kpis ? (
                <KpiGrid
                  kpis={kpis}
                  compareRange={report.compareRange}
                  onRevenueClick={() => setRevenueOpen(true)}
                />
              ) : null}

              <Card>
                <CardHeader
                  title="Traffic trend"
                  subtitle="Active users and sessions across the selected sites"
                  right={report.demo ? <DemoBadge /> : undefined}
                />
                <div className="p-4">
                  {trend.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted">
                      No traffic recorded in this period.
                    </p>
                  ) : (
                    <TrendChart points={trend} />
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Traffic acquisition"
                  subtitle="Where sessions and revenue came from during this period"
                />
                <AcquisitionTable
                  channels={channels}
                  sourceMedium={sourceMedium}
                  revenueCurrency={revenueCurrency}
                />
              </Card>

              {hasProducts || hasNewReturning ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {hasProducts ? (
                    <Card>
                      <CardHeader title="Top products" subtitle="Best-selling items by revenue" />
                      <ProductsTable rows={products} revenueCurrency={revenueCurrency} />
                    </Card>
                  ) : null}
                  {hasNewReturning ? (
                    <Card>
                      <CardHeader
                        title="New vs returning"
                        subtitle="First-time vs returning active users"
                      />
                      <NewReturningChart rows={newVsReturning} />
                    </Card>
                  ) : null}
                </div>
              ) : null}

              {funnel || hasSearchTerms ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {funnel ? (
                    <Card>
                      <CardHeader
                        title="Ecommerce funnel"
                        subtitle="Where shoppers drop off between viewing and buying"
                      />
                      <FunnelChart funnel={funnel} />
                    </Card>
                  ) : null}
                  {hasSearchTerms ? (
                    <Card>
                      <CardHeader
                        title="Site search terms"
                        subtitle="What visitors searched for on your sites"
                      />
                      <SearchTermsTable rows={searchTerms} />
                    </Card>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader title="Top pages" subtitle="Most viewed pages" />
                  <TopPagesTable rows={topPages} />
                </Card>
                <Card>
                  <CardHeader title="Landing pages" subtitle="Entry points into your sites" />
                  <LandingPagesTable rows={landingPages} />
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader title="Geography" subtitle="Top countries by active users" />
                  <GeographyTable rows={geography} />
                </Card>
                <Card>
                  <CardHeader title="Devices" subtitle="Active users by device category" />
                  <div className="p-5">
                    <DevicesChart rows={devices} />
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      ) : null}

      {revenueOpen && report ? (
        <RevenueBreakdown
          properties={report.properties}
          range={report.range}
          onClose={() => setRevenueOpen(false)}
        />
      ) : null}
    </div>
  );
}
