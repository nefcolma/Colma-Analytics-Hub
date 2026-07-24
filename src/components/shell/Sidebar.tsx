"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReport } from "@/components/report-context";

const NAV = [
  { href: "/", label: "Overview", icon: "M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z" },
  { href: "/properties", label: "Sites", icon: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/reports", label: "Reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/exports", label: "Exports", icon: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" },
  { href: "/settings", label: "Settings", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4a8.5 8.5 0 0 1-.1 1.3l2 1.6-2 3.4-2.4-1a8.6 8.6 0 0 1-2.2 1.3L15.4 22h-4l-.4-2.6a8.6 8.6 0 0 1-2.2-1.3l-2.4 1-2-3.4 2-1.6a8.5 8.5 0 0 1 0-2.6l-2-1.6 2-3.4 2.4 1a8.6 8.6 0 0 1 2.2-1.3L11.4 2h4l.4 2.6a8.6 8.6 0 0 1 2.2 1.3l2.4-1 2 3.4-2 1.6c.1.4.1.9.1 1.3z" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { connected, demo, configLoaded } = useReport();

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-ink text-white/90 lg:flex">
      <div className="px-5 pb-5 pt-6">
        <Link href="/" className="block">
          <span className="font-display text-[19px] leading-tight tracking-tight text-white">
            Colma Analytics Hub
          </span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-white/50">
            GA4 command center
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main navigation">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 ${active ? "text-accent" : "text-white/50"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs">
        {!configLoaded ? (
          <span className="text-white/50">Checking connection…</span>
        ) : demo ? (
          <span className="flex items-center gap-2 text-accent">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            Demo mode
          </span>
        ) : connected ? (
          <span className="flex items-center gap-2 text-emerald-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Google connected
          </span>
        ) : (
          <span className="flex items-center gap-2 text-white/60">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/40" />
            Not connected
          </span>
        )}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="no-print sticky bottom-0 z-30 flex border-t border-line bg-surface lg:hidden"
    >
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${
              active ? "text-accent-strong" : "text-muted"
            }`}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
