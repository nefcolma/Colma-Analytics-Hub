"use client";

import { useState } from "react";
import { fmtInt, fmtRate } from "@/lib/format";
import type { DimensionRow } from "@/lib/types";
import { Column, DataTable } from "./DataTable";

const num = (v?: number) => fmtInt(v);

function metricCols(
  keys: { id: keyof DimensionRow & string; label: string }[]
): Column<DimensionRow>[] {
  return keys.map((k) => ({
    id: k.id,
    label: k.label,
    align: "right",
    value: (r) => r[k.id] as number | undefined,
    render: (r) =>
      k.id === "engagementRate" ? fmtRate(r.engagementRate) : num(r[k.id] as number | undefined),
  }));
}

export function AcquisitionTable({
  channels,
  sourceMedium,
}: {
  channels: DimensionRow[];
  sourceMedium: DimensionRow[];
}) {
  const [mode, setMode] = useState<"channels" | "source">("channels");
  const rows = mode === "channels" ? channels : sourceMedium;
  return (
    <div>
      <div className="flex justify-end px-4 pt-3">
        <div role="group" aria-label="Acquisition dimension" className="inline-flex rounded-md border border-line-strong p-0.5">
          {(
            [
              ["channels", "Channel group"],
              ["source", "Source / medium"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                mode === id ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.key}
        initialSort={{ id: "sessions", desc: true }}
        columns={[
          {
            id: "key",
            label: mode === "channels" ? "Default channel group" : "Source / medium",
            value: (r) => r.key,
          },
          ...metricCols([
            { id: "sessions", label: "Sessions" },
            { id: "activeUsers", label: "Active users" },
            { id: "engagementRate", label: "Engagement rate" },
            { id: "keyEvents", label: "Key events" },
          ]),
        ]}
      />
    </div>
  );
}

export function TopPagesTable({ rows }: { rows: DimensionRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => `${r.key}|${r.detail}`}
      initialSort={{ id: "views", desc: true }}
      columns={[
        {
          id: "key",
          label: "Page",
          value: (r) => r.key,
          render: (r) => (
            <span className="block max-w-56">
              <span className="block truncate">{r.key}</span>
              <span className="block truncate font-mono text-[11px] text-muted">{r.detail}</span>
            </span>
          ),
        },
        ...metricCols([
          { id: "views", label: "Views" },
          { id: "activeUsers", label: "Active users" },
          { id: "engagementRate", label: "Engagement" },
        ]),
      ]}
    />
  );
}

export function LandingPagesTable({ rows }: { rows: DimensionRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.key}
      initialSort={{ id: "sessions", desc: true }}
      columns={[
        {
          id: "key",
          label: "Landing page",
          value: (r) => r.key,
          render: (r) => <span className="block max-w-56 truncate font-mono text-xs">{r.key}</span>,
        },
        ...metricCols([
          { id: "sessions", label: "Sessions" },
          { id: "engagementRate", label: "Engagement rate" },
          { id: "keyEvents", label: "Key events" },
        ]),
      ]}
    />
  );
}

export function GeographyTable({ rows }: { rows: DimensionRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.key}
      initialSort={{ id: "activeUsers", desc: true }}
      columns={[
        { id: "key", label: "Country", value: (r) => r.key },
        ...metricCols([
          { id: "activeUsers", label: "Active users" },
          { id: "sessions", label: "Sessions" },
        ]),
      ]}
    />
  );
}
