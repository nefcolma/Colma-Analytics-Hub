import { NextResponse, type NextRequest } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { revokeToken } from "@/lib/google/token";
import { getServerTokens } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/google/disconnect
 * Revokes the Google grant (refresh token when available, otherwise the access
 * token). The client follows up with signOut() to clear the session cookie.
 */
export async function POST(req: NextRequest) {
  const tokens = await getServerTokens(req);
  if (!tokens) return NextResponse.json({ revoked: false });

  let revoked = false;
  try {
    // Revoking the refresh token invalidates the whole grant; fall back to the
    // access token when the stored refresh token can no longer be decrypted.
    const target =
      (tokens.refreshTokenEnc ? decryptSecret(tokens.refreshTokenEnc) : null) ??
      tokens.accessToken;
    revoked = await revokeToken(target);
  } catch {
    revoked = false;
  }
  return NextResponse.json({ revoked });
}
