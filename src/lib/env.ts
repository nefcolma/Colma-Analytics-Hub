/** Environment helpers. Secrets are only ever read server-side. */

export function googleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID || undefined;
}

export function googleClientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET || undefined;
}

export function isGoogleConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

/** Auth.js session secret. Accepts SESSION_SECRET (per project spec) or AUTH_SECRET. */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production" && isGoogleConfigured()) {
    throw new Error("SESSION_SECRET (or AUTH_SECRET) must be set in production.");
  }
  // Demo-only fallback so the app can boot without configuration.
  return "colma-analytics-hub-demo-only-secret";
}

export function tokenEncryptionKey(): string | undefined {
  return process.env.TOKEN_ENCRYPTION_KEY || undefined;
}
