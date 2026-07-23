"use client";

import { signIn } from "next-auth/react";
import { useReport } from "@/components/report-context";
import { Button, DemoBadge } from "@/components/ui/primitives";
import { DateRangeControl } from "@/components/controls/DateRangeControl";
import { PropertyPicker } from "@/components/controls/PropertyPicker";

export function Header() {
  const {
    configLoaded,
    googleConfigured,
    connected,
    demo,
    userEmail,
    userName,
    reportStatus,
    generate,
    selected,
  } = useReport();

  const initial = (userName ?? userEmail ?? "?").charAt(0).toUpperCase();

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 lg:px-8">
        <span className="mr-auto flex items-center gap-2 lg:hidden">
          <span className="font-display text-base tracking-tight">Colma Analytics Hub</span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <PropertyPicker />
          <DateRangeControl />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {demo ? <DemoBadge /> : null}
          {configLoaded && googleConfigured && !connected ? (
            <Button size="sm" variant="secondary" onClick={() => signIn("google")}>
              Connect Google
            </Button>
          ) : null}
          {connected ? (
            <span className="hidden items-center gap-2 md:flex" title={userEmail}>
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-3 text-xs font-semibold text-white"
              >
                {initial}
              </span>
              <span className="max-w-40 truncate text-xs text-muted">{userEmail}</span>
            </span>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void generate()}
            disabled={reportStatus === "loading" || selected.length === 0}
          >
            {reportStatus === "loading" ? (
              <>
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                Generating…
              </>
            ) : (
              "Generate report"
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
