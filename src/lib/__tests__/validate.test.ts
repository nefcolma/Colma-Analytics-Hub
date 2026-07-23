import { describe, expect, it } from "vitest";
import { MAX_PROPERTIES, validateReportRequest } from "@/lib/report/validate";

const range = { startDate: "2026-06-23", endDate: "2026-07-22" };
const valid = { propertyIds: ["263501877"], range, compare: "previous_period" as const };

describe("validateReportRequest", () => {
  it("accepts a well-formed request and defaults compare and demo", () => {
    const res = validateReportRequest({ propertyIds: ["1234"], range });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.compare).toBe("none");
      expect(res.value.demo).toBe(false);
    }
  });

  it("preserves an explicit comparison mode", () => {
    const res = validateReportRequest(valid);
    expect(res.ok && res.value.compare).toBe("previous_period");
  });

  it("de-duplicates repeated property IDs", () => {
    const res = validateReportRequest({ propertyIds: ["1", "1", "2"], range });
    expect(res.ok && res.value.propertyIds).toEqual(["1", "2"]);
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, undefined, "string", 42, true]) {
      expect(validateReportRequest(body).ok).toBe(false);
    }
  });

  it("requires at least one property", () => {
    expect(validateReportRequest({ propertyIds: [], range }).ok).toBe(false);
    expect(validateReportRequest({ range }).ok).toBe(false);
  });

  it("caps the number of properties per report", () => {
    const many = Array.from({ length: MAX_PROPERTIES + 1 }, (_, i) => String(i + 1));
    const res = validateReportRequest({ propertyIds: many, range });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain(String(MAX_PROPERTIES));
  });

  it("rejects non-numeric property IDs, including injection attempts", () => {
    expect(validateReportRequest({ propertyIds: ["../../admin"], range }).ok).toBe(false);
    expect(validateReportRequest({ propertyIds: ["properties/123"], range }).ok).toBe(false);
    expect(validateReportRequest({ propertyIds: [123], range }).ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(validateReportRequest({ propertyIds: ["1"], range: { startDate: "23-06-2026", endDate: "2026-07-22" } }).ok).toBe(false);
    expect(validateReportRequest({ propertyIds: ["1"], range: { startDate: "2026-13-01", endDate: "2026-13-05" } }).ok).toBe(false);
    expect(validateReportRequest({ propertyIds: ["1"] }).ok).toBe(false);
  });

  it("rejects a reversed range", () => {
    const res = validateReportRequest({
      propertyIds: ["1"],
      range: { startDate: "2026-07-22", endDate: "2026-06-23" },
    });
    expect(res.ok).toBe(false);
  });

  it("rejects ranges longer than the supported window", () => {
    const res = validateReportRequest({
      propertyIds: ["1"],
      range: { startDate: "2024-01-01", endDate: "2026-07-22" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("400");
  });

  it("accepts a single-day range", () => {
    expect(
      validateReportRequest({
        propertyIds: ["1"],
        range: { startDate: "2026-07-22", endDate: "2026-07-22" },
      }).ok
    ).toBe(true);
  });

  it("rejects an unknown comparison mode", () => {
    expect(validateReportRequest({ ...valid, compare: "previous_decade" }).ok).toBe(false);
  });

  it("treats demo as an explicit boolean opt-in", () => {
    expect(validateReportRequest({ ...valid, demo: "yes" }).ok && true).toBe(true);
    const res = validateReportRequest({ ...valid, demo: "yes" });
    expect(res.ok && res.value.demo).toBe(false);
    const res2 = validateReportRequest({ ...valid, demo: true });
    expect(res2.ok && res2.value.demo).toBe(true);
  });
});
