import "server-only";

import { timingSafeEqual } from "node:crypto";

import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Constant-time string comparison. Returns false on length mismatch
 * without leaking timing information about the expected value.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Resolves the acting user id for an API request.
 *
 * Two auth paths:
 *
 * 1. Machine-to-machine: if the request carries `Authorization: Bearer
 *    <token>`, ENGINE_API_KEY is configured (non-empty), and the token
 *    matches ENGINE_API_KEY in constant time, the service user is looked
 *    up by ENGINE_SERVICE_USER_EMAIL. If that env var is missing or no
 *    such user exists, this yields null — it never falls back to an
 *    arbitrary user.
 *
 * 2. Otherwise (no bearer, no configured key, or a non-matching token):
 *    the regular Auth.js session (`auth()`), identical to the previous
 *    inline checks in each route.
 *
 * Returns the acting user id, or null when the request is
 * unauthenticated. Never logs the token or the API key.
 */
export async function resolveApiUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  const apiKey = process.env.ENGINE_API_KEY;

  if (bearerMatch && apiKey && safeEqual(bearerMatch[1], apiKey)) {
    const serviceEmail = process.env.ENGINE_SERVICE_USER_EMAIL;
    if (!serviceEmail) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { email: serviceEmail.trim().toLowerCase() },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  const session = await auth();
  return session?.user?.id ?? null;
}
