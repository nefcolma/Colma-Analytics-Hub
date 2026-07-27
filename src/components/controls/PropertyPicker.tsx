"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReport } from "@/components/report-context";

/** Header dropdown for selecting one, several, or all sites per account. */
export function PropertyPicker() {
  const { accounts, properties, selected, setSelected, toggleSelected, propsStatus } = useReport();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Focus the search box whenever the menu opens.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Filter sites by name, ID, or account name. An account whose name matches
  // keeps all of its sites; otherwise only the matching sites show.
  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts
      .map((acc) => {
        const accountMatches = acc.accountName.toLowerCase().includes(q);
        return {
          ...acc,
          properties: accountMatches
            ? acc.properties
            : acc.properties.filter(
                (p) =>
                  p.propertyName.toLowerCase().includes(q) || p.propertyId.includes(q)
              ),
        };
      })
      .filter((acc) => acc.properties.length > 0);
  }, [accounts, query]);

  const visibleIds = useMemo(
    () => filteredAccounts.flatMap((a) => a.properties.map((p) => p.propertyId)),
    [filteredAccounts]
  );
  const hasQuery = query.trim().length > 0;

  const label =
    selected.length === 0
      ? "No sites"
      : selected.length === properties.length
        ? `All sites (${properties.length})`
        : selected.length === 1
          ? (properties.find((p) => p.propertyId === selected[0])?.propertyName ?? "1 site")
          : `${selected.length} sites`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
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
        <div className="absolute left-0 z-50 mt-1.5 flex max-h-96 w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {/* Search */}
          <div className="border-b border-line p-2">
            <div className="relative">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sites by name or ID"
                aria-label="Search sites"
                className="h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2.5 text-sm placeholder:text-muted focus:border-ink/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-muted">
              {selected.length} of {properties.length} selected
            </span>
            <div className="flex gap-2 text-xs">
              <button
                className="text-accent-strong hover:underline"
                onClick={() => setSelected([...new Set([...selected, ...visibleIds])])}
              >
                {hasQuery ? "Select matches" : "Select all"}
              </button>
              <button className="text-muted hover:underline" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          </div>

          {/* Site list */}
          <div className="overflow-auto p-2 pt-1">
            {filteredAccounts.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted">
                No sites match “{query.trim()}”.
              </p>
            ) : (
              filteredAccounts.map((acc) => {
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
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
