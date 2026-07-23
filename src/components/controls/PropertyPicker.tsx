"use client";

import { useEffect, useRef, useState } from "react";
import { useReport } from "@/components/report-context";

/** Header dropdown for selecting one, several, or all properties per account. */
export function PropertyPicker() {
  const { accounts, properties, selected, setSelected, toggleSelected, propsStatus } = useReport();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label =
    selected.length === 0
      ? "No properties"
      : selected.length === properties.length
        ? `All properties (${properties.length})`
        : selected.length === 1
          ? (properties.find((p) => p.propertyId === selected[0])?.propertyName ?? "1 property")
          : `${selected.length} properties`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={propsStatus !== "ready"}
        className="flex h-9 max-w-56 items-center gap-2 truncate rounded-md border border-line-strong bg-surface px-3 text-sm hover:border-ink/40 disabled:opacity-50"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span className="truncate">{label}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1.5 max-h-96 w-80 overflow-auto rounded-lg border border-line bg-surface p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-muted">
              {selected.length} of {properties.length} selected
            </span>
            <div className="flex gap-2 text-xs">
              <button
                className="text-accent-strong hover:underline"
                onClick={() => setSelected(properties.map((p) => p.propertyId))}
              >
                Select all
              </button>
              <button className="text-muted hover:underline" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          </div>
          {accounts.map((acc) => {
            const ids = acc.properties.map((p) => p.propertyId);
            const allChecked = ids.every((id) => selected.includes(id));
            return (
              <div key={acc.accountId} className="mb-1">
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3 hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() =>
                      setSelected(
                        allChecked
                          ? selected.filter((id) => !ids.includes(id))
                          : [...new Set([...selected, ...ids])]
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#c96a11]"
                  />
                  {acc.accountName}
                </label>
                {acc.properties.map((p) => (
                  <label
                    key={p.propertyId}
                    className="ml-4 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-paper"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.propertyId)}
                      onChange={() => toggleSelected(p.propertyId)}
                      className="h-3.5 w-3.5 accent-[#c96a11]"
                    />
                    <span className="flex-1 truncate">{p.propertyName}</span>
                    <span className="font-mono text-[10px] text-muted">{p.propertyId}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
