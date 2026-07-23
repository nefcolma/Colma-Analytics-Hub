import { googleClientId, googleClientSecret } from "../env";

export type RefreshedTokens = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

/**
 * Exchanges a refresh token for a new access token. Runs on the server only —
 * the client secret is never sent to the browser and tokens are never logged.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    // Do not include response bodies (which may echo tokens) in thrown errors.
    throw new Error(`Token refresh failed with status ${res.status}`);
  }
  const data = (await res.json()) as RefreshedTokens;
  if (!data.access_token) throw new Error("Token refresh response missing access token");
  return data;
}

/** Revokes a Google OAuth token (access or refresh). */
export async function revokeToken(token: string): Promise<boolean> {
  const res = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  return res.ok;
}
