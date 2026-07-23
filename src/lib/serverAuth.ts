import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { sessionSecret } from "./env";
import type { ReportError } from "./types";

export type ServerTokens = {
  accessToken: string;
  /** Encrypted refresh token, for revocation on disconnect. */
  refreshTokenEnc?: string;
  /** Stable per-user cache key (email or subject). */
  userKey: string;
};

/**
 * Reads the Auth.js JWT server-side. Tokens never travel to the browser —
 * route handlers decrypt the session cookie directly.
 */
export async function getServerTokens(req: NextRequest): Promise<ServerTokens | null> {
  const secure = req.nextUrl.protocol === "https:";
  const token = await getToken({ req, secret: sessionSecret(), secureCookie: secure });
  if (!token || typeof token.accessToken !== "string") return null;
  if (token.authError) return null;
  return {
    accessToken: token.accessToken,
    refreshTokenEnc:
      typeof token.refreshTokenEnc === "string" ? token.refreshTokenEnc : undefined,
    userKey: (token.email as string | undefined) ?? (token.sub as string | undefined) ?? "user",
  };
}

export const UNAUTHENTICATED: ReportError = {
  code: "unauthenticated",
  message: "Connect a Google account to load real Analytics data, or use demo mode.",
  retryable: false,
};
