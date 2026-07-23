import { NextResponse, type NextRequest } from "next/server";
import { demoReport } from "@/lib/demo/report";
import { isGoogleConfigured } from "@/lib/env";
import { generateReport } from "@/lib/report/engine";
import { validateReportRequest } from "@/lib/report/validate";
import { getServerTokens, UNAUTHENTICATED } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/report
 * Generates a (possibly multi-property) report. All Google calls run on the
 * server; failures are isolated per property so partial results still return.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "unknown", message: "Request body must be JSON.", retryable: false } },
      { status: 400 }
    );
  }
  const parsed = validateReportRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: { code: "unknown", message: parsed.message, retryable: false } },
      { status: 400 }
    );
  }
  const { propertyIds, range, compare, demo } = parsed.value;

  if (demo || !isGoogleConfigured()) {
    return NextResponse.json(demoReport(propertyIds, range, compare ?? "none"));
  }

  const tokens = await getServerTokens(req);
  if (!tokens) {
    return NextResponse.json({ error: UNAUTHENTICATED }, { status: 401 });
  }

  const report = await generateReport({
    accessToken: tokens.accessToken,
    userKey: tokens.userKey,
    propertyIds,
    range,
    compare: compare ?? "none",
  });
  return NextResponse.json(report);
}
