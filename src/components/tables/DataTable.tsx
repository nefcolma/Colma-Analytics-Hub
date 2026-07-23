"use client";

import { useMemo, useState } from "react";

export type Column<T> = {
  id: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
  /** Value used for sorting */
  value: (row: T) => string | number | undefined;
  /** Rendered cell (defaults to value) */
  render?: (row: T) => React.ReactNode;
  width?: string;
};

/** Generic sortable table used by every report section. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  emptyLabel = "No rows for this period.",
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSort?: { id: string; desc: boolean };
  emptyLabel?: string;
  dense?: boolean;
}) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, sort, columns]);

  const toggleSort = (col: Column<T>) => {
    if (col.sortable === false) return;
    setSort((prev) =>
      prev?.id === col.id ? { id: col.id, desc: !prev.desc } : { id: col.id, desc: true }
    );
  };

  const pad = dense ? "px-3 py-2" : "px-4 py-2.5";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {columns.map((col) => (
              <th key={col.id} scope="col" className={`${pad} font-medium`} style={{ width: col.width }}>
                {col.sortable === false ? (
                  <span className={col.align === "right" ? "block text-right" : ""}>{col.label}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    aria-label={`Sort by ${col.label}`}
                    className={`inline-flex items-center gap-1 hover:text-ink ${
                      col.align === "right" ? "w-full justify-end" : ""
                    }`}
                  >
                    {col.label}
                    <span aria-hidden className="text-[9px]">
                      {sort?.id === col.id ? (sort.desc ? "▼" : "▲") : ""}
                    </span>
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${pad} text-center text-muted`}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={`${pad} ${col.align === "right" ? "tabular text-right" : ""}`}
                  >
                    {col.render ? col.render(row) : (col.value(row) ?? "–")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
