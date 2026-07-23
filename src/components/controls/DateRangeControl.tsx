"use client";

import { PRESET_LABELS, isValidIsoDate } from "@/lib/dateRanges";
import type { CompareMode, PresetId } from "@/lib/types";
import { useReport } from "@/components/report-context";

const PRESETS = Object.entries(PRESET_LABELS) as [PresetId, string][];

const COMPARE_LABELS: Record<CompareMode, string> = {
  none: "No comparison",
  previous_period: "Compare to previous period",
  previous_year: "Compare to previous year",
};

export function DateRangeControl() {
  const { rangeSel, setRangeSel, compare, setCompare, resolvedRange } = useReport();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="date-preset">
        Date range
      </label>
      <select
        id="date-preset"
        value={rangeSel.preset}
        onChange={(e) =>
          setRangeSel({
            preset: e.target.value as PresetId,
            start: resolvedRange.startDate,
            end: resolvedRange.endDate,
          })
        }
        className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm hover:border-ink/40"
      >
        {PRESETS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>

      {rangeSel.preset === "custom" ? (
        <span className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="date-start">
            Start date
          </label>
          <input
            id="date-start"
            type="date"
            value={rangeSel.start ?? resolvedRange.startDate}
            max={rangeSel.end ?? resolvedRange.endDate}
            onChange={(e) => {
              if (isValidIsoDate(e.target.value)) {
                setRangeSel({ ...rangeSel, preset: "custom", start: e.target.value });
              }
            }}
            className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm"
          />
          <span aria-hidden className="text-muted">
            –
          </span>
          <label className="sr-only" htmlFor="date-end">
            End date
          </label>
          <input
            id="date-end"
            type="date"
            value={rangeSel.end ?? resolvedRange.endDate}
            min={rangeSel.start ?? resolvedRange.startDate}
            onChange={(e) => {
              if (isValidIsoDate(e.target.value)) {
                setRangeSel({ ...rangeSel, preset: "custom", end: e.target.value });
              }
            }}
            className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm"
          />
        </span>
      ) : null}

      <label className="sr-only" htmlFor="compare-mode">
        Comparison
      </label>
      <select
        id="compare-mode"
        value={compare}
        onChange={(e) => setCompare(e.target.value as CompareMode)}
        className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm hover:border-ink/40"
      >
        {(Object.entries(COMPARE_LABELS) as [CompareMode, string][]).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
