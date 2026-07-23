import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { sessionSecret, tokenEncryptionKey } from "./env";

/**
 * AES-256-GCM encryption for refresh tokens at rest.
 * TOKEN_ENCRYPTION_KEY may be 32 raw bytes as base64/hex, or any passphrase
 * (hashed to 32 bytes). Falls back to a key derived from the session secret
 * so tokens are never stored in plaintext even when the dedicated key is unset.
 */
function keyBytes(): Buffer {
  const raw = tokenEncryptionKey() ?? `token-key:${sessionSecret()}`;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {
    // fall through to hash
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${ct.toString("base64")}.${tag.toString("base64")}`;
}

/**
 * Returns null rather than throwing when a payload is malformed, tampered with,
 * or was encrypted under a previous key. Callers treat that as "no stored token"
 * and ask the user to reconnect, which is safer than crashing a request.
 */
export function decryptSecret(payload: string): string | null {
  const [version, ivB64, ctB64, tagB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !ctB64 || !tagB64) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
