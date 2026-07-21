import "server-only";

import { db } from "@/lib/db";
import type { WordPressCredentials } from "@/types/wordpress";

/**
 * Thrown when the requested connection doesn't exist, or exists but
 * belongs to a different user. Callers should treat this as a 404 —
 * never leak whether the connectionId exists for another user.
 */
export class WordPressConnectionNotFoundError extends Error {
  constructor() {
    super("WordPress connection not found.");
    this.name = "WordPressConnectionNotFoundError";
  }
}

const ENCRYPTED_PREFIX = "enc:";

/**
 * Decrypts an `appPassword` value that was stored encrypted (prefixed with
 * "enc:") by dynamically importing lib/crypto.ts.
 *
 * lib/crypto.ts is owned by the settings-agent and is not guaranteed to
 * exist in every worktree yet. This module never imports it statically —
 * only via a dynamic `import()` — so this file (and anything that imports
 * it) keeps compiling/building even before lib/crypto.ts lands.
 *
 * Confirmed contract (integrated): lib/crypto.ts exports
 * `decrypt(value: string): string`, which takes the value WITH its "enc:"
 * prefix intact (it strips the prefix itself and passes through
 * non-prefixed values unchanged). So the full `encryptedValue` — not a
 * stripped ciphertext — must be passed through. A `decryptSecret` export is
 * tried as a fallback name in case a future revision lands it under that
 * name instead.
 */
async function decryptAppPassword(encryptedValue: string): Promise<string> {
  let cryptoModule: Record<string, unknown>;
  try {
    // Import via a non-literal specifier so TypeScript doesn't try to
    // resolve "@/lib/crypto" at compile time — this keeps the build green
    // even before the settings-agent's lib/crypto.ts exists.
    const cryptoModulePath = "@/lib/crypto";
    cryptoModule = (await import(cryptoModulePath)) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      "appPassword is encrypted (enc: prefix) but lib/crypto.ts is not available to decrypt it.",
      { cause: error }
    );
  }

  const decryptFn =
    (cryptoModule.decrypt as ((value: string) => string) | undefined) ??
    (cryptoModule.decryptSecret as ((value: string) => string) | undefined);

  if (typeof decryptFn !== "function") {
    throw new Error(
      "lib/crypto.ts was found but exports neither decrypt() nor decryptSecret()."
    );
  }

  // Pass the full value (with "enc:" prefix) — decrypt() strips it itself.
  return decryptFn(encryptedValue);
}

/**
 * Loads a WordPressConnection owned by `userId` and returns ready-to-use
 * WordPressCredentials. Decrypts appPassword transparently when it was
 * stored encrypted (see decryptAppPassword above); otherwise the stored
 * value is used as-is (public sites may have an empty appPassword).
 */
export async function getWordPressCredentials(
  connectionId: string,
  userId: string
): Promise<WordPressCredentials> {
  const connection = await db.wordPressConnection.findFirst({
    where: { id: connectionId, userId },
  });

  if (!connection) {
    throw new WordPressConnectionNotFoundError();
  }

  const appPassword = connection.appPassword.startsWith(ENCRYPTED_PREFIX)
    ? await decryptAppPassword(connection.appPassword)
    : connection.appPassword;

  return {
    url: connection.url,
    username: connection.username,
    appPassword,
  };
}
