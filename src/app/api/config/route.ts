import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public, non-sensitive configuration flags for the client shell. */
export async function GET() {
  return NextResponse.json({
    googleConfigured: isGoogleConfigured(),
  });
}
