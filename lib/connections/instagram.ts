import "server-only";

import { db } from "@/lib/db";
import { decrypt, encrypt, maskSecret } from "@/lib/crypto";

import { describeFetchError, withTimeout } from "./shared";
import type {
  InstagramConnectionInput,
  InstagramConnectionSafe,
  InstagramTestInput,
  InstagramTestResult,
} from "./schemas";

export async function saveInstagramConnection(
  userId: string,
  input: InstagramConnectionInput
): Promise<InstagramConnectionSafe> {
  const connection = await db.instagramConnection.upsert({
    where: { userId },
    update: {
      accessToken: encrypt(input.accessToken),
      businessAccountId: input.businessAccountId,
      igUsername: input.igUsername || null,
    },
    create: {
      userId,
      accessToken: encrypt(input.accessToken),
      businessAccountId: input.businessAccountId,
      igUsername: input.igUsername || null,
    },
  });

  return toSafeInstagramConnection(connection);
}

export async function getInstagramConnection(
  userId: string
): Promise<InstagramConnectionSafe | null> {
  const connection = await db.instagramConnection.findUnique({
    where: { userId },
  });

  return connection ? toSafeInstagramConnection(connection) : null;
}

function toSafeInstagramConnection(connection: {
  id: string;
  businessAccountId: string;
  igUsername: string | null;
  accessToken: string;
  createdAt: Date;
}): InstagramConnectionSafe {
  return {
    id: connection.id,
    businessAccountId: connection.businessAccountId,
    igUsername: connection.igUsername,
    accessTokenMasked: maskSecret(decrypt(connection.accessToken)),
    createdAt: connection.createdAt,
  };
}

/**
 * Tests an Instagram (Meta Graph API) connection. If no override input is
 * given, tests the user's already-saved connection.
 */
export async function testInstagramConnection(
  userId: string,
  input: InstagramTestInput
): Promise<InstagramTestResult> {
  let accessToken = input.accessToken;
  let businessAccountId = input.businessAccountId;

  if (!accessToken || !businessAccountId) {
    const saved = await db.instagramConnection.findUnique({
      where: { userId },
    });

    if (!saved) {
      return { ok: false, error: "No Instagram connection saved yet." };
    }

    accessToken = accessToken || decrypt(saved.accessToken);
    businessAccountId = businessAccountId || saved.businessAccountId;
  }

  try {
    const params = new URLSearchParams({
      fields: "username",
      access_token: accessToken,
    });

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(
        businessAccountId
      )}?${params.toString()}`,
      { signal: withTimeout() }
    );

    const data: unknown = await response.json();

    if (
      !response.ok ||
      (typeof data === "object" && data !== null && "error" in data)
    ) {
      const message =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error?: { message?: unknown } }).error?.message ===
          "string"
          ? (data as { error: { message: string } }).error.message
          : `Meta Graph API responded with status ${response.status}.`;
      return { ok: false, error: message };
    }

    const username =
      typeof data === "object" &&
      data !== null &&
      "username" in data &&
      typeof (data as { username?: unknown }).username === "string"
        ? (data as { username: string }).username
        : undefined;

    return { ok: true, username };
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
}
