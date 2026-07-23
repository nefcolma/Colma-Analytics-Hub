import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    /** Whether a valid Google connection exists (no tokens are ever exposed). */
    connected?: boolean;
    authError?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    /** Unix seconds */
    expiresAt?: number;
    /** AES-256-GCM encrypted refresh token */
    refreshTokenEnc?: string;
    authError?: string;
  }
}
