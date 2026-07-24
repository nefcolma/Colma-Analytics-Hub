"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { compareRangeFor, resolveRange } from "@/lib/dateRanges";
import {
  chunk,
  orderReports,
  REPORT_CHUNK_CONCURRENCY,
  REPORT_CHUNK_SIZE,
} from "@/lib/report/batch";
import type {
  ApiError,
  CompareMode,
  DateRange,
  PropertiesResponse,
  PropertyReport,
  PropertySummary,
  RangeSelection,
  ReportError,
  ReportResponse,
} from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "error";

type ReportContextValue = {
  // Environment / connection
  configLoaded: boolean;
  googleConfigured: boolean;
  connected: boolean;
  authError?: string;
  userEmail?: string;
  userName?: string;
  /** True when the app is serving clearly-labeled demo data. */
  demo: boolean;
  demoOptIn: boolean;
  setDemoOptIn: (v: boolean) => void;

  // Properties
  accounts: PropertiesResponse["accounts"];
  properties: PropertySummary[];
  propsStatus: Status;
  propsError?: ReportError;
  reloadProperties: () => void;

  // Selection
  selected: string[];
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;

  // Date range + comparison
  rangeSel: RangeSelection;
  setRangeSel: (s: RangeSelection) => void;
  compare: CompareMode;
  setCompare: (c: CompareMode) => void;
  resolvedRange: DateRange;

  // Report
  report: ReportResponse | null;
  reportStatus: Status;
  reportError?: ReportError;
  generate: (overrideIds?: string[]) => Promise<void>;
  retryFailed: () => Promise<void>;
};

const ReportContext = createContext<ReportContextValue | null>(null);

const UNKNOWN_ERROR: ReportError = {
  code: "unknown",
  message: "Something went wrong. Retry in a moment.",
  retryable: true,
};

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const [configLoaded, setConfigLoaded] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [demoOptIn, setDemoOptInState] = useState(false);

  const [accounts, setAccounts] = useState<PropertiesResponse["accounts"]>([]);
  const [propsStatus, setPropsStatus] = useState<Status>("idle");
  const [propsError, setPropsError] = useState<ReportError | undefined>();

  const [selected, setSelected] = useState<string[]>([]);
  const [rangeSel, setRangeSel] = useState<RangeSelection>({ preset: "last30" });
  const [compare, setCompare] = useState<CompareMode>("previous_period");

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportStatus, setReportStatus] = useState<Status>("idle");
  const [reportError, setReportError] = useState<ReportError | undefined>();

  const autoRan = useRef(false);

  const connected = Boolean(session?.connected);
  const demo = configLoaded && (!googleConfigured || (!connected && demoOptIn));
  const resolvedRange = useMemo(() => resolveRange(rangeSel), [rangeSel]);
  const properties = useMemo(() => accounts.flatMap((a) => a.properties), [accounts]);

  // Load public config + persisted demo preference once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: { googleConfigured: boolean }) => {
        if (cancelled) return;
        setGoogleConfigured(c.googleConfigured);
        setConfigLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setConfigLoaded(true);
      });
    // Read the persisted preference after paint so the first client render
    // still matches the server-rendered HTML.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        setDemoOptInState(window.localStorage.getItem("cah-demo") === "1");
      } catch {
        // Storage unavailable; demo stays opt-in per session.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setDemoOptIn = useCallback((v: boolean) => {
    setDemoOptInState(v);
    try {
      window.localStorage.setItem("cah-demo", v ? "1" : "0");
    } catch {
      // Non-fatal.
    }
  }, []);

  const loadProperties = useCallback(async () => {
    setPropsStatus("loading");
    setPropsError(undefined);
    try {
      const res = await fetch(`/api/analytics/properties${demo ? "?demo=1" : ""}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        setPropsError(body?.error ?? UNKNOWN_ERROR);
        setPropsStatus("error");
        return;
      }
      const data = (await res.json()) as PropertiesResponse;
      setAccounts(data.accounts);
      setPropsStatus("ready");
      setSelected((prev) => {
        const all = data.accounts.flatMap((a) => a.properties.map((p) => p.propertyId));
        const kept = prev.filter((id) => all.includes(id));
        if (kept.length > 0) return kept;
        return all.length <= 12 ? all : all.slice(0, 1);
      });
    } catch {
      setPropsError(UNKNOWN_ERROR);
      setPropsStatus("error");
    }
  }, [demo]);

  // Load properties whenever a data source becomes available, and clear them
  // when the connection goes away. Both branches run outside the synchronous
  // effect body so they never trigger a cascading render.
  useEffect(() => {
    if (!configLoaded) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (demo || connected) {
        void loadProperties();
      } else {
        setPropsStatus("idle");
        setAccounts([]);
        setReport(null);
        setReportStatus("idle");
        autoRan.current = false;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configLoaded, demo, connected, loadProperties]);

  const runReport = useCallback(
    async (ids: string[]): Promise<ReportResponse | null> => {
      const postChunk = async (chunkIds: string[]): Promise<ReportResponse> => {
        const res = await fetch("/api/analytics/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyIds: chunkIds, range: resolvedRange, compare, demo }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiError | null;
          throw body?.error ?? UNKNOWN_ERROR;
        }
        return (await res.json()) as ReportResponse;
      };

      // Small selections: a single request (unchanged behaviour).
      if (ids.length <= REPORT_CHUNK_SIZE) return await postChunk(ids);

      // Large selections are split into batches so each server request stays
      // within Cloudflare Workers' per-request subrequest limit. Batches run
      // with small concurrency to be gentle on Google's quota; a failed batch
      // is turned into retryable per-site errors rather than dropping sites.
      const batches = chunk(ids, REPORT_CHUNK_SIZE);
      const collected: PropertyReport[] = [];
      for (let i = 0; i < batches.length; i += REPORT_CHUNK_CONCURRENCY) {
        const group = batches.slice(i, i + REPORT_CHUNK_CONCURRENCY);
        const settled = await Promise.allSettled(group.map(postChunk));
        for (const s of settled) {
          if (s.status === "fulfilled") collected.push(...s.value.properties);
        }
      }
      const summaries = new Map(properties.map((p) => [p.propertyId, p]));
      return {
        demo,
        generatedAt: new Date().toISOString(),
        range: resolvedRange,
        compare,
        compareRange: compareRangeFor(resolvedRange, compare),
        properties: orderReports(ids, collected, summaries),
      };
    },
    [resolvedRange, compare, demo, properties]
  );

  const generate = useCallback(
    async (overrideIds?: string[]) => {
      const ids = overrideIds ?? selected;
      if (ids.length === 0) {
        setReportError({
          code: "unknown",
          message: "Select at least one site to generate a report.",
          retryable: false,
        });
        setReportStatus("error");
        return;
      }
      setReportStatus("loading");
      setReportError(undefined);
      try {
        const data = await runReport(ids);
        setReport(data);
        setReportStatus("ready");
      } catch (err) {
        setReportError((err as ReportError) ?? UNKNOWN_ERROR);
        setReportStatus("error");
      }
    },
    [selected, runReport]
  );

  const retryFailed = useCallback(async () => {
    if (!report) return;
    const failedIds = report.properties.filter((p) => p.status === "error").map((p) => p.propertyId);
    if (failedIds.length === 0) return;
    setReportStatus("loading");
    try {
      const partial = await runReport(failedIds);
      if (partial) {
        setReport((prev) => {
          if (!prev) return partial;
          const byId = new Map(partial.properties.map((p) => [p.propertyId, p]));
          return {
            ...prev,
            generatedAt: partial.generatedAt,
            properties: prev.properties.map((p) => byId.get(p.propertyId) ?? p),
          };
        });
      }
      setReportStatus("ready");
    } catch (err) {
      setReportError((err as ReportError) ?? UNKNOWN_ERROR);
      setReportStatus("error");
    }
  }, [report, runReport]);

  // Generate a first report automatically once properties + selection exist.
  // Deferred out of the synchronous effect body to avoid a cascading render.
  useEffect(() => {
    if (autoRan.current) return;
    if (propsStatus !== "ready" || selected.length === 0) return;
    autoRan.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void generate();
    });
    return () => {
      cancelled = true;
    };
  }, [propsStatus, selected, generate]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const value: ReportContextValue = {
    configLoaded,
    googleConfigured,
    connected,
    authError: session?.authError,
    userEmail: session?.user?.email ?? undefined,
    userName: session?.user?.name ?? undefined,
    demo,
    demoOptIn,
    setDemoOptIn,
    accounts,
    properties,
    propsStatus,
    propsError,
    reloadProperties: () => void loadProperties(),
    selected,
    setSelected,
    toggleSelected,
    rangeSel,
    setRangeSel,
    compare,
    setCompare,
    resolvedRange,
    report,
    reportStatus,
    reportError,
    generate,
    retryFailed,
  };

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used inside ReportProvider");
  return ctx;
}
