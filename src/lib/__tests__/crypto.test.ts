import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a refresh token", () => {
    const token = "1//0gABCDEF-refresh-token_value.123";
    const enc = encryptSecret(token);
    expect(enc).not.toContain(token);
    expect(decryptSecret(enc)).toBe(token);
  });

  it("produces a versioned four-part payload", () => {
    const parts = encryptSecret("hello").split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("uses a fresh IV for each call, so ciphertexts differ", () => {
    expect(encryptSecret("same input")).not.toBe(encryptSecret("same input"));
  });

  it("round-trips unicode and empty-ish values", () => {
    expect(decryptSecret(encryptSecret("señal—✓"))).toBe("señal—✓");
    expect(decryptSecret(encryptSecret(" "))).toBe(" ");
  });

  it("returns null instead of throwing on a tampered payload", () => {
    const enc = encryptSecret("secret");
    const parts = enc.split(".");
    parts[2] = Buffer.from("tampered ciphertext").toString("base64");
    expect(decryptSecret(parts.join("."))).toBeNull();
  });

  it("returns null on a malformed payload", () => {
    expect(decryptSecret("not-a-payload")).toBeNull();
    expect(decryptSecret("")).toBeNull();
  });
});
