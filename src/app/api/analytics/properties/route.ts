import { NextResponse, type NextRequest } from "next/server";
import { isGoogleConfigured } from "@/lib/env";
import { listAccountSummaries } from "@/lib/google/adminApi";
import { GoogleApiError } from "@/lib/google/errors";
import { demoPropertiesResponse } from "@/lib/demo/fixtures";
import { getServerTokens, UNAUTHENTICATED } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/properties
 * Lists all GA4 accounts and properties the connected user can access
 * (Admin API accountSummaries.list, with pagination). `?demo=1` — or a
 * missing Google configuration — returns clearly-labeled demo fixtures.
 */
export async function GET(req: NextRequest) {
  const wantsDemo = req.nextUrl.searchParams.get("demo") === "1";
  if (wantsDemo || !isGoogleConfigured()) {
    return NextResponse.json(demoPropertiesResponse());
  }

  const tokens = await getServerTokens(req);
  if (!tokens) {
    return NextResponse.json({ error: UNAUTHENTICATED }, { status: 401 });
  }

  try {
    const data = await listAccountSummaries(tokens.accessToken, tokens.userKey);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof GoogleApiError) {
      const status =
        err.detail.code === "expired" ? 401 : err.detail.code === "permission" ? 403 : 502;
      return NextResponse.json({ error: err.detail }, { status });
    }
    return NextResponse.json(
      {
        error: {
          code: "unknown",
          message: "Could not load Analytics accounts. Retry in a moment.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
