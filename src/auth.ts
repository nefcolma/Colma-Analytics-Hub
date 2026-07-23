import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { googleClientId, googleClientSecret, isGoogleConfigured, sessionSecret } from "@/lib/env";
import { refreshAccessToken } from "@/lib/google/token";

const GA_SCOPES = [
  "openid",
  "email",
  "profile",
  // Read-only: the app never requests Analytics write permissions.
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

/**
 * Auth.js (NextAuth v5) with JWT sessions.
 *
 * Storage decision: tokens live inside the Auth.js session JWT, which is
 * JWE-encrypted with SESSION_SECRET and stored in an httpOnly cookie. The
 * Google refresh token is additionally encrypted with AES-256-GCM using
 * TOKEN_ENCRYPTION_KEY before being placed in the JWT, so it is encrypted at
 * rest and never readable by the browser. No token is ever included in a JSON
 * response to the client (the session callback exposes only profile + status).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: sessionSecret(),
  trustHost: true,
  session: { strategy: "jwt" },
  providers: isGoogleConfigured()
    ? [
        Google({
          clientId: googleClientId(),
          clientSecret: googleClientSecret(),
          authorization: {
            params: {
              scope: GA_SCOPES,
              access_type: "offline",
              prompt: "consent",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: capture tokens from the provider account.
      if (account) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
        if (account.refresh_token) {
          token.refreshTokenEnc = encryptSecret(account.refresh_token);
        }
        delete token.authError;
        return token;
      }

      // Still valid (60s safety margin)?
      const expiresAt = typeof token.expiresAt === "number" ? token.expiresAt : 0;
      if (token.accessToken && Date.now() < expiresAt * 1000 - 60_000) return token;

      // Refresh using the encrypted refresh token.
      try {
        const enc = token.refreshTokenEnc;
        if (typeof enc !== "string") throw new Error("Missing refresh token");
        const refreshToken = decryptSecret(enc);
        if (!refreshToken) throw new Error("Refresh token could not be decrypted");
        const refreshed = await refreshAccessToken(refreshToken);
        token.accessToken = refreshed.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        if (refreshed.refresh_token) {
          token.refreshTokenEnc = encryptSecret(refreshed.refresh_token);
        }
        delete token.authError;
      } catch {
        token.authError = "RefreshTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      // Expose connection status only — never tokens.
      session.connected = Boolean(token.accessToken) && !token.authError;
      session.authError = typeof token.authError === "string" ? token.authError : undefined;
      return session;
    },
  },
});
