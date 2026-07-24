"use client";

import { useReport } from "@/components/report-context";
import { Button } from "@/components/ui/primitives";

/** Shown when some — but not all — properties in a report failed. */
export function PartialFailureBanner() {
  const { report, retryFailed, reportStatus } = useReport();
  if (!report) return null;
  const failed = report.properties.filter((p) => p.status === "error");
  if (failed.length === 0 || failed.length === report.properties.length) return null;

  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
      <div className="flex-1">
        <p className="font-medium text-accent-strong">
          {failed.length} of {report.properties.length} sites could not be reported.
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-ink/80">
          {failed.map((p) => (
            <li key={p.propertyId}>
              <span className="font-medium">{p.propertyName}</span>
              {" — "}
              {p.error?.message ?? "Unknown error."}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">Successful results are shown below.</p>
      </div>
      <Button size="sm" onClick={() => void retryFailed()} disabled={reportStatus === "loading"}>
        Retry failed
      </Button>
    </div>
  );
}
