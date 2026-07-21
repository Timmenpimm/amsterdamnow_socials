import "server-only";

import { db } from "@/lib/db";
import { decrypt, encrypt, maskSecret } from "@/lib/crypto";

import { describeFetchError, withTimeout } from "./shared";
import type {
  WordPressConnectionInput,
  WordPressConnectionSafe,
  WordPressTestInput,
  WordPressTestResult,
} from "./schemas";

/**
 * Saves (creates or replaces) the user's WordPress connection. MVP supports
 * a single connection per user, so any existing connection is updated.
 */
export async function saveWordPressConnection(
  userId: string,
  input: WordPressConnectionInput
): Promise<WordPressConnectionSafe> {
  const existing = await db.wordPressConnection.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const encryptedPassword = encrypt(input.appPassword);

  const connection = existing
    ? await db.wordPressConnection.update({
        where: { id: existing.id },
        data: {
          url: input.url,
          username: input.username,
          appPassword: encryptedPassword,
        },
      })
    : await db.wordPressConnection.create({
        data: {
          userId,
          url: input.url,
          username: input.username,
          appPassword: encryptedPassword,
        },
      });

  return toSafeWordPressConnection(connection);
}

export async function getWordPressConnection(
  userId: string
): Promise<WordPressConnectionSafe | null> {
  const connection = await db.wordPressConnection.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return connection ? toSafeWordPressConnection(connection) : null;
}

function toSafeWordPressConnection(connection: {
  id: string;
  url: string;
  username: string;
  appPassword: string;
  createdAt: Date;
}): WordPressConnectionSafe {
  return {
    id: connection.id,
    url: connection.url,
    username: connection.username,
    appPasswordMasked: maskSecret(decrypt(connection.appPassword)),
    createdAt: connection.createdAt,
  };
}

/**
 * Tests a WordPress connection via the public REST API. If credentials are
 * omitted, falls back to an unauthenticated request — this still counts as
 * a valid connection for public sites (per product spec).
 *
 * If no override input is given, tests the user's already-saved connection.
 */
export async function testWordPressConnection(
  userId: string,
  input: WordPressTestInput
): Promise<WordPressTestResult> {
  let url = input.url;
  let username = input.username;
  let appPassword = input.appPassword;

  if (!url) {
    const saved = await db.wordPressConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!saved) {
      return { ok: false, error: "No WordPress connection saved yet." };
    }

    url = saved.url;
    username = username || saved.username;
    appPassword = appPassword || decrypt(saved.appPassword);
  }

  const baseUrl = url.replace(/\/+$/, "");
  const headers: Record<string, string> = {};

  if (username && appPassword) {
    const token = Buffer.from(`${username}:${appPassword}`).toString(
      "base64"
    );
    headers.Authorization = `Basic ${token}`;
  }

  try {
    const response = await fetch(
      `${baseUrl}/wp-json/wp/v2/posts?per_page=1`,
      { headers, signal: withTimeout() }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error:
            "Authentication failed. Check the username and application password.",
        };
      }
      return {
        ok: false,
        error: `WordPress site responded with status ${response.status}.`,
      };
    }

    const siteName = await fetchWordPressSiteName(baseUrl);
    return { ok: true, siteName };
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
}

async function fetchWordPressSiteName(
  baseUrl: string
): Promise<string | undefined> {
  try {
    const response = await fetch(`${baseUrl}/wp-json`, {
      signal: withTimeout(),
    });
    if (!response.ok) return undefined;

    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "name" in data &&
      typeof (data as { name?: unknown }).name === "string"
    ) {
      return (data as { name: string }).name;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
