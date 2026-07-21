import "server-only";

import crypto from "node:crypto";

/**
 * HMAC-signed public render URLs.
 *
 * The Instagram Graph API fetches carousel slide images over a plain,
 * unauthenticated GET request — it cannot log in or send a session cookie
 * — so app/api/public/carousel/[carouselId]/[slideIndex] cannot be gated by
 * auth() like the rest of the app. Instead each URL is signed with a
 * server-only secret: possession of a valid `?t=` token (not a session) is
 * what proves the request is legitimate.
 *
 * Token = HMAC-SHA256(PUBLIC_RENDER_SECRET, `${carouselId}:${slideIndex}`),
 * hex-encoded.
 */

function getSecret(): string {
  const secret = process.env.PUBLIC_RENDER_SECRET;

  if (!secret) {
    throw new Error(
      "PUBLIC_RENDER_SECRET is not set. Generate one with `openssl rand -hex 32` and add it to your environment (.env)."
    );
  }

  return secret;
}

function sign(carouselId: string, slideIndex: number): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${carouselId}:${slideIndex}`)
    .digest("hex");
}

/**
 * Builds the full, publicly-fetchable URL (including a valid `?t=` token)
 * for one rendered carousel slide.
 *
 * `baseUrl` must be the app's publicly reachable origin (no trailing
 * slash) — see PUBLIC_BASE_URL in .env.example. A localhost/private origin
 * will produce a URL that only resolves on the local network, which is
 * fine for local testing but useless to Instagram's servers.
 */
export function publicSlideUrl(
  baseUrl: string,
  carouselId: string,
  slideIndex: number
): string {
  const token = sign(carouselId, slideIndex);
  const path = `/api/public/carousel/${encodeURIComponent(carouselId)}/${slideIndex}`;
  return `${baseUrl.replace(/\/+$/, "")}${path}?t=${token}`;
}

/**
 * Verifies a `?t=` token against the expected HMAC for
 * (carouselId, slideIndex). Returns false (never throws) for a missing,
 * malformed, or mismatched token — callers map that to a 403.
 *
 * Uses a constant-time comparison so a mismatching token doesn't leak how
 * many leading bytes were correct via response timing.
 */
export function verifyRenderToken(
  carouselId: string,
  slideIndex: number,
  token: string | null | undefined
): boolean {
  if (!token) return false;

  const expected = Buffer.from(sign(carouselId, slideIndex), "hex");

  let provided: Buffer;
  try {
    provided = Buffer.from(token, "hex");
  } catch {
    return false;
  }

  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(expected, provided);
}
