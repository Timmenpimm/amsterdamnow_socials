import "server-only";

import crypto from "node:crypto";

/**
 * AES-256-GCM helpers for at-rest encryption of secrets (WordPress
 * application passwords, Instagram access tokens) stored in the database.
 *
 * Encrypted values are prefixed with "enc:" so `decrypt()` can safely pass
 * through plain/legacy values unchanged (idempotent, non-destructive).
 *
 * Key: `ENCRYPTION_KEY` env var, 64 hex characters (32 bytes).
 * Generate one with: `openssl rand -hex 32`
 */

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:";
const IV_LENGTH = 12; // recommended nonce size for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;

  if (!hex) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to your environment (.env)."
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate one with `openssl rand -hex 32`."
    );
  }

  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string and returns a base64 payload prefixed with
 * "enc:" containing iv + auth tag + ciphertext.
 */
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  return `${ENC_PREFIX}${payload}`;
}

/**
 * Decrypts a value previously produced by `encrypt()`. Values that do not
 * start with the "enc:" prefix are returned unchanged, so callers can pass
 * through plain/legacy or already-decrypted values safely.
 */
export function decrypt(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) {
    return value;
  }

  const key = getKey();
  const raw = Buffer.from(value.slice(ENC_PREFIX.length), "base64");

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Masks a secret for display: keeps only the last `visible` characters.
 * Used so tokens/passwords are never sent back to the client in full.
 */
export function maskSecret(value: string, visible = 4): string {
  if (!value) return "";
  const tail = value.slice(-visible);
  return `••••${tail}`;
}
