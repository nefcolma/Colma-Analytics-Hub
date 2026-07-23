import { describe, expect, it } from "vitest";
import {
  parseDimensionRows,
  parseKpiReport,
  parseTrend,
  type RunReportResult,
} from "@/lib/google/normalize";

const kpiRow = (label: string | null, values: string[]) => ({
  dimensionValues: label ? [{ value: label }] : [],
  metricValues: values.map((value) => ({ value })),
});

describe("parseKpiReport", () => {
  it("reads a single-range report", () => {
    const report: RunReportResult = {
      rows: [kpiRow(null, ["120", "40", "150", "300", "0.62", "95.5", "8", "0"])],
    };
    const { current, previous } = parseKpiReport(report, false);
    expect(previous).toBeUndefined();
    expect(current).toEqual({
      activeUsers: 120,
      newUsers: 40,
      sessions: 150,
      views: 300,
      engagementRate: 0.62,
      averageSessionDuration: 95.5,
      keyEvents: 8,
      totalRevenue: 0,
    });
  });

  it("splits date_range_0 and date_range_1 into current and previous", () => {
    const report: RunReportResult = {
      rows: [
        kpiRow("date_range_1", ["50", "20", "60", "100", "0.4", "60", "2", "10"]),
        kpiRow("date_range_0", ["100", "40", "120", "220", "0.5", "80", "5", "25"]),
      ],
    };
    const { current, previous } = parseKpiReport(report, true);
    expect(current?.activeUsers).toBe(100);
    expect(current?.totalRevenue).toBe(25);
    expect(previous?.activeUsers).toBe(50);
    expect(previous?.totalRevenue).toBe(10);
  });

  it("returns zeroed sets when a compared property has no rows", () => {
    const { current, previous } = parseKpiReport({ rows: [] }, true);
    expect(current?.sessions).toBe(0);
    expect(previous?.sessions).toBe(0);
  });

  it("returns an empty object for a missing report", () => {
    expect(parseKpiReport(undefined, true)).toEqual({});
  });

  it("coerces non-numeric metric values to zero", () => {
    const report: RunReportResult = { rows: [kpiRow(null, ["", "n/a", "12"])] };
    const { current } = parseKpiReport(report, false);
    expect(current?.activeUsers).toBe(0);
    expect(current?.newUsers).toBe(0);
    expect(current?.sessions).toBe(12);
  });
});

describe("parseTrend", () => {
  it("sorts by date and drops malformed rows", () => {
    const report: RunReportResult = {
      rows: [
        { dimensionValues: [{ value: "20260703" }], metricValues: [{ value: "9" }, { value: "11" }] },
        { dimensionValues: [{ value: "20260701" }], metricValues: [{ value: "5" }, { value: "7" }] },
        { dimensionValues: [{ value: "(other)" }], metricValues: [{ value: "1" }, { value: "1" }] },
      ],
    };
    const trend = parseTrend(report);
    expect(trend.map((t) => t.date)).toEqual(["20260701", "20260703"]);
    expect(trend[0]).toEqual({ date: "20260701", activeUsers: 5, sessions: 7 });
  });

  it("returns an empty array for a missing report", () => {
    expect(parseTrend(undefined)).toEqual([]);
  });
});

describe("parseDimensionRows", () => {
  it("maps metrics in request order", () => {
    const report: RunReportResult = {
      rows: [
        {
          dimensionValues: [{ value: "Organic Search" }],
          metricValues: [{ value: "300" }, { value: "210" }, { value: "0.71" }, { value: "12" }],
        },
      ],
    };
    const rows = parseDimensionRows(report, ["sessions", "activeUsers", "engagementRate", "keyEvents"]);
    expect(rows[0]).toEqual({
      key: "Organic Search",
      sessions: 300,
      activeUsers: 210,
      engagementRate: 0.71,
      keyEvents: 12,
    });
  });

  it("captures a second dimension as detail", () => {
    const report: RunReportResult = {
      rows: [
        {
          dimensionValues: [{ value: "Urns — Home" }, { value: "/urns" }],
          metricValues: [{ value: "900" }, { value: "400" }, { value: "0.6" }],
        },
      ],
    };
    const rows = parseDimensionRows(report, ["views", "activeUsers", "engagementRate"], true);
    expect(rows[0].key).toBe("Urns — Home");
    expect(rows[0].detail).toBe("/urns");
    expect(rows[0].views).toBe(900);
  });

  it("labels blank dimension values as (not set)", () => {
    const report: RunReportResult = {
      rows: [{ dimensionValues: [{ value: "" }], metricValues: [{ value: "3" }] }],
    };
    expect(parseDimensionRows(report, ["sessions"])[0].key).toBe("(not set)");
  });

  it("returns an empty array for a missing report", () => {
    expect(parseDimensionRows(undefined, ["sessions"])).toEqual([]);
  });
});
