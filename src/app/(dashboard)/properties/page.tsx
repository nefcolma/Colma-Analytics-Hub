"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useReport } from "@/components/report-context";
import { ConnectCard } from "@/components/ConnectCard";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DemoBadge,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/primitives";
import type { PropertyReport } from "@/lib/types";

const PAGE_SIZE = 10;

export default function PropertiesPage() {
  const router = useRouter();
  const {
    configLoaded,
    connected,
    demo,
    accounts,
    properties,
    propsStatus,
    propsError,
    reloadProperties,
    selected,
    toggleSelected,
    setSelected,
    report,
    generate,
  } = useReport();

  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [page, setPage] = useState(1);

  const lastByProperty = useMemo(() => {
    const map = new Map<string, PropertyReport>();
    for (const p of report?.properties ?? []) map.set(p.propertyId, p);
    return map;
  }, [report]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      if (accountFilter !== "all" && p.accountId !== accountFilter) return false;
      if (!q) return true;
      return (
        p.propertyName.toLowerCase().includes(q) ||
        p.propertyId.includes(q) ||
        p.accountName.toLowerCase().includes(q)
      );
    });
  }, [properties, query, accountFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const viewReport = (propertyId: string) => {
    setSelected([propertyId]);
    void generate([propertyId]);
    router.push("/");
  };

  if (!configLoaded) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-64 w-full" />
      </Card>
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
        title="Could not load sites"
        body={propsError?.message ?? "Something went wrong while contacting Google."}
        onRetry={reloadProperties}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Sites</h1>
          <p className="mt-0.5 text-sm text-muted">
            Every GA4 site the connected account can access, grouped by Analytics account.
          </p>
        </div>
        {demo ? <DemoBadge /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="property-search">
          Search properties
        </label>
        <input
          id="property-search"
          type="search"
          placeholder="Search by name, ID, or account"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="h-9 w-64 rounded-md border border-line-strong bg-surface px-3 text-sm"
        />
        <label className="sr-only" htmlFor="account-filter">
          Filter by account
        </label>
        <select
          id="account-filter"
          value={accountFilter}
          onChange={(e) => {
            setAccountFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
        >
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.accountName}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">
          {selected.length} selected for multi-site reports
        </span>
        <Button
          size="sm"
          variant="primary"
          disabled={selected.length === 0}
          onClick={() => {
            void generate();
            router.push("/");
          }}
        >
          Report on selection
        </Button>
      </div>

      {propsStatus === "loading" ? (
        <Card className="p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-10 w-full" />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No sites match"
          body="Adjust the search or account filter, or reload the site list."
          action={<Button onClick={reloadProperties}>Reload sites</Button>}
        />
      ) : (
        <Card>
          <CardHeader
            title={`${filtered.length} ${filtered.length === 1 ? "site" : "sites"}`}
            subtitle="Select sites with the checkboxes to include them in consolidated reports"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="w-10 px-4 py-2.5">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Site</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Time zone</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Currency</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Last report</th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const last = lastByProperty.get(p.propertyId);
                  return (
                    <tr
                      key={p.propertyId}
                      className="border-b border-line/60 last:border-0 hover:bg-paper/60"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.propertyName}`}
                          checked={selected.includes(p.propertyId)}
                          onChange={() => toggleSelected(p.propertyId)}
                          className="h-4 w-4 accent-[#c96a11]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{p.propertyName}</span>
                        <span className="font-mono text-[11px] text-muted">{p.propertyId}</span>
                      </td>
                      <td className="px-4 py-3">{p.accountName}</td>
                      <td className="px-4 py-3 text-muted">{p.timeZone ?? "–"}</td>
                      <td className="px-4 py-3 text-muted">{p.currencyCode ?? "–"}</td>
                      <td className="px-4 py-3">
                        {!last ? (
                          <Chip tone="neutral">Not yet reported</Chip>
                        ) : last.status === "error" ? (
                          <Chip tone="negative">Failed</Chip>
                        ) : last.noData ? (
                          <Chip tone="warn">No data</Chip>
                        ) : (
                          <Chip tone="positive">Reporting</Chip>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {last && report
                          ? new Date(report.generatedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "–"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" onClick={() => viewReport(p.propertyId)}>
                          View report
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-xs text-muted">
                Page {safePage} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
