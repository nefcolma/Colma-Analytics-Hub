"use client";

import Link from "next/link";
import { useReport } from "@/components/report-context";
import { ConnectCard } from "@/components/ConnectCard";
import {
  BlockSkeleton,
  Button,
  Card,
  CardHeader,
  DemoBadge,
  EmptyState,
} from "@/components/ui/primitives";
import { buildSectionCsv, buildSummaryCsv, sectionLabel, type CsvSection } from "@/lib/csv";
import { fmtIsoDate } from "@/lib/format";

const SECTIONS: CsvSection[] = [
  "trend",
  "channels",
  "sourceMedium",
  "topPages",
  "landingPages",
  "geography",
  "devices",
];

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const { configLoaded, connected, demo, report, reportStatus, generate } = useReport();

  if (!configLoaded) return <BlockSkeleton />;

  if (!demo && !connected) {
    return (
      <div className="py-10">
        <ConnectCard />
      </div>
    );
  }

  const stamp = report ? `${report.range.startDate}_${report.range.endDate}` : "";
  const prefix = report?.demo ? "colma-analytics-demo" : "colma-analytics";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Exports</h1>
          <p className="mt-0.5 text-sm text-muted">
            Download the current report as CSV, or open a print-ready view to save as PDF.
          </p>
        </div>
        {report?.demo ? <DemoBadge /> : null}
      </div>

      {!report ? (
        <EmptyState
          title="Nothing to export yet"
          body="Generate a report first — exports always reflect the report currently loaded, including its date range and comparison settings."
          action={
            <Button
              variant="primary"
              onClick={() => void generate()}
              disabled={reportStatus === "loading"}
            >
              Generate report
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader
              title="Current report"
              subtitle={`${fmtIsoDate(report.range.startDate)} – ${fmtIsoDate(
                report.range.endDate
              )} · ${report.properties.filter((p) => p.status === "ok").length} of ${
                report.properties.length
              } properties reporting`}
            />
            <div className="space-y-4 p-5">
              <div>
                <h3 className="text-sm font-semibold">Summary CSV</h3>
                <p className="mt-1 text-sm text-muted">
                  One row per property with every KPI, plus report metadata: generation time, date
                  range, comparison range, currency, time zone, and per-property status.
                </p>
                <Button
                  variant="primary"
                  className="mt-3"
                  onClick={() => download(`${prefix}-summary_${stamp}.csv`, buildSummaryCsv(report))}
                >
                  Download summary CSV
                </Button>
              </div>

              <div className="border-t border-line pt-4">
                <h3 className="text-sm font-semibold">Section CSVs</h3>
                <p className="mt-1 text-sm text-muted">
                  Each section exports the consolidated rows across all successful properties.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SECTIONS.map((section) => (
                    <Button
                      key={section}
                      size="sm"
                      onClick={() =>
                        download(
                          `${prefix}-${section}_${stamp}.csv`,
                          buildSectionCsv(report, section)
                        )
                      }
                    >
                      {sectionLabel(section)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <h3 className="text-sm font-semibold">PDF</h3>
                <p className="mt-1 text-sm text-muted">
                  The print view lays the report out on paper with its metadata header. Use your
                  browser&apos;s print dialog and choose &quot;Save as PDF&quot; as the destination.
                </p>
                <Link
                  href="/print"
                  target="_blank"
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium hover:border-ink/40"
                >
                  Open print view
                </Link>
              </div>
            </div>
          </Card>

          {report.demo ? (
            <p className="text-xs text-accent-strong">
              Exports generated in demo mode carry a &quot;Demo data&quot; marker in their metadata
              header so they are never mistaken for real Analytics figures.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
