import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorFromStatus, GoogleApiError } from "@/lib/google/errors";

const listAccountSummaries = vi.fn();
const runPropertyReport = vi.fn();

vi.mock("@/lib/google/adminApi", () => ({
  listAccountSummaries: (...args: unknown[]) => listAccountSummaries(...args),
}));
vi.mock("@/lib/google/dataApi", () => ({
  runPropertyReport: (...args: unknown[]) => runPropertyReport(...args),
}));

const { generateReport } = await import("@/lib/report/engine");

const RANGE = { startDate: "2026-06-23", endDate: "2026-07-22" };

const summaries = {
  accounts: [
    {
      accountId: "acc-1",
      accountName: "UPD Urns Current",
      properties: [
        { propertyId: "111", propertyName: "UPD Urns Store", accountId: "acc-1", accountName: "UPD Urns Current", currencyCode: "USD", timeZone: "America/Los_Angeles" },
        { propertyId: "222", propertyName: "UPD Field Services", accountId: "acc-1", accountName: "UPD Urns Current", currencyCode: "CAD", timeZone: "America/Vancouver" },
      ],
    },
  ],
};

const okReport = (propertyId: string, propertyName: string) => ({
  propertyId,
  propertyName,
  accountName: "UPD Urns Current",
  currencyCode: "USD",
  timeZone: "America/Los_Angeles",
  status: "ok" as const,
  hasRevenue: false,
  noData: false,
  kpis: { current: { activeUsers: 1, newUsers: 1, sessions: 1, views: 1, engagementRate: 0.5, averageSessionDuration: 10, keyEvents: 0, totalRevenue: 0 } },
});

// Unique user keys keep the module-level report cache from leaking between tests.
let n = 0;
const userKey = () => `user-${n++}@example.test`;

beforeEach(() => {
  listAccountSummaries.mockReset().mockResolvedValue(summaries);
  runPropertyReport.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorFromStatus", () => {
  it("maps HTTP statuses to actionable, correctly-retryable errors", () => {
    expect(errorFromStatus(401, "x").code).toBe("expired");
    expect(errorFromStatus(403, "x").code).toBe("permission");
    expect(errorFromStatus(404, "x").code).toBe("not_found");
    expect(errorFromStatus(429, "x").code).toBe("quota");
    expect(errorFromStatus(503, "x").code).toBe("network");
    expect(errorFromStatus(418, "x").code).toBe("unknown");
  });

  it("marks only transient failures as retryable", () => {
    expect(errorFromStatus(429, "x").retryable).toBe(true);
    expect(errorFromStatus(500, "x").retryable).toBe(true);
    expect(errorFromStatus(403, "x").retryable).toBe(false);
    expect(errorFromStatus(401, "x").retryable).toBe(false);
  });
});

describe("generateReport", () => {
  it("returns a report for every requested property", async () => {
    runPropertyReport.mockImplementation(async (summary: { propertyId: string; propertyName: string }) =>
      okReport(summary.propertyId, summary.propertyName)
    );
    const report = await generateReport({
      accessToken: "token",
      userKey: userKey(),
      propertyIds: ["111", "222"],
      range: RANGE,
      compare: "previous_period",
    });
    expect(report.demo).toBe(false);
    expect(report.properties.map((p) => p.propertyId)).toEqual(["111", "222"]);
    expect(report.compareRange).toEqual({ startDate: "2026-05-24", endDate: "2026-06-22" });
  });

  it("isolates failures so one bad property does not discard the others", async () => {
    runPropertyReport.mockImplementation(async (summary: { propertyId: string; propertyName: string }) => {
      if (summary.propertyId === "222") {
        throw new GoogleApiError(errorFromStatus(403, "running a report"));
      }
      return okReport(summary.propertyId, summary.propertyName);
    });

    const report = await generateReport({
      accessToken: "token",
      userKey: userKey(),
      propertyIds: ["111", "222"],
      range: RANGE,
      compare: "none",
    });

    const [ok, failed] = report.properties;
    expect(ok.status).toBe("ok");
    expect(failed.status).toBe("error");
    expect(failed.error?.code).toBe("permission");
    // The failed property still carries its real name for the retry banner.
    expect(failed.propertyName).toBe("UPD Field Services");
  });

  it("converts unexpected errors into a retryable network failure", async () => {
    runPropertyReport.mockRejectedValue(new Error("socket hang up"));
    const report = await generateReport({
      accessToken: "token",
      userKey: userKey(),
      propertyIds: ["111"],
      range: RANGE,
      compare: "none",
    });
    expect(report.properties[0].error?.code).toBe("network");
    expect(report.properties[0].error?.retryable).toBe(true);
  });

  it("still reports when the account summary lookup fails", async () => {
    listAccountSummaries.mockRejectedValue(new Error("admin api down"));
    runPropertyReport.mockImplementation(async (summary: { propertyId: string; propertyName: string }) =>
      okReport(summary.propertyId, summary.propertyName)
    );
    const report = await generateReport({
      accessToken: "token",
      userKey: userKey(),
      propertyIds: ["111"],
      range: RANGE,
      compare: "none",
    });
    expect(report.properties[0].status).toBe("ok");
    expect(runPropertyReport).toHaveBeenCalled();
  });

  it("serves repeated identical requests from cache instead of re-querying Google", async () => {
    runPropertyReport.mockImplementation(async (summary: { propertyId: string; propertyName: string }) =>
      okReport(summary.propertyId, summary.propertyName)
    );
    const key = userKey();
    const args = { accessToken: "token", userKey: key, propertyIds: ["111"], range: RANGE, compare: "none" as const };
    await generateReport(args);
    await generateReport(args);
    expect(runPropertyReport).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures, so a retry hits Google again", async () => {
    runPropertyReport.mockRejectedValueOnce(new GoogleApiError(errorFromStatus(429, "running a report")));
    const key = userKey();
    const args = { accessToken: "token", userKey: key, propertyIds: ["111"], range: RANGE, compare: "none" as const };

    const first = await generateReport(args);
    expect(first.properties[0].error?.code).toBe("quota");

    runPropertyReport.mockImplementation(async (summary: { propertyId: string; propertyName: string }) =>
      okReport(summary.propertyId, summary.propertyName)
    );
    const second = await generateReport(args);
    expect(second.properties[0].status).toBe("ok");
  });

  it("keeps different users' cached reports separate", async () => {
    runPropertyReport.mockImplementation(async (summary: { propertyId: string; propertyName: string }) =>
      okReport(summary.propertyId, summary.propertyName)
    );
    const base = { accessToken: "token", propertyIds: ["111"], range: RANGE, compare: "none" as const };
    await generateReport({ ...base, userKey: userKey() });
    await generateReport({ ...base, userKey: userKey() });
    expect(runPropertyReport).toHaveBeenCalledTimes(2);
  });
});
