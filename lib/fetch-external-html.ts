import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-hardened fetcher for user-supplied template URLs.
 *
 * The URL comes straight from a form field, so it is treated as hostile:
 * every hop is DNS-resolved and every resolved address is checked against the
 * private/loopback/link-local ranges *before* the request goes out, redirects
 * are followed manually (max 3) so a public host cannot bounce us into the
 * internal network, and the response body is size-capped while streaming.
 */

export type ExternalFetchErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "timeout"
  | "http_error"
  | "not_html"
  | "too_large"
  | "fetch_failed";

export class ExternalFetchError extends Error {
  readonly code: ExternalFetchErrorCode;
  /** HTTP status, when the failure came from an actual response. */
  readonly status?: number;

  constructor(code: ExternalFetchErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ExternalFetchError";
    this.code = code;
    this.status = status;
  }
}

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "amsterdamnow-socials-template-import/1.0";

/** Hostnames that never resolve to something we want to fetch, regardless of DNS. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

/** Suffixes covering local/internal naming schemes and cloud metadata endpoints. */
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".home.arpa",
];

/** Cheap markup sniff for bodies served as text/plain. */
function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 4000).toLowerCase();
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<body") ||
    head.includes("<div") ||
    head.includes("<style")
  );
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** True for loopback, private, link-local, CGNAT, multicast and broadcast IPv4. */
function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return true;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = octets;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 special-use
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast

  return false;
}

/** True for ::, ::1, IPv4-mapped private ranges, fc00::/7 (ULA) and fe80::/10 (link-local). */
function isBlockedIpv6(address: string): boolean {
  const host = address.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];

  if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // IPv4-mapped / IPv4-compatible (::ffff:10.0.0.1) — check the embedded v4.
  const mapped = host.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isBlockedIpv4(mapped[1]);
  }

  const firstGroup = host.split(":")[0];
  if (!firstGroup) {
    // Leading "::" without an embedded v4 address — unspecified-ish, block.
    return true;
  }

  const value = Number.parseInt(firstGroup, 16);
  if (!Number.isFinite(value)) {
    return true;
  }

  if ((value & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((value & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local

  return false;
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return isBlockedIpv4(address);
  }
  if (family === 6) {
    return isBlockedIpv6(address);
  }
  return true;
}

/**
 * Rejects the URL when its hostname is a blocked name, is a literal blocked
 * IP, or resolves (via DNS) to ANY blocked address. Runs per hop.
 */
async function assertHostAllowed(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHostname(hostname)) {
    throw new ExternalFetchError(
      "blocked_host",
      `Host "${url.hostname}" is niet toegestaan.`
    );
  }

  if (isIP(hostname) !== 0) {
    if (isBlockedAddress(hostname)) {
      throw new ExternalFetchError(
        "blocked_host",
        `Host "${url.hostname}" is niet toegestaan.`
      );
    }
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new ExternalFetchError(
      "blocked_host",
      `Host "${url.hostname}" kon niet worden opgezocht.`
    );
  }

  if (records.length === 0) {
    throw new ExternalFetchError(
      "blocked_host",
      `Host "${url.hostname}" kon niet worden opgezocht.`
    );
  }

  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new ExternalFetchError(
        "blocked_host",
        `Host "${url.hostname}" verwijst naar een intern adres.`
      );
    }
  }
}

function parseUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ExternalFetchError("invalid_url", "Ongeldige URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExternalFetchError(
      "invalid_url",
      "Alleen http- en https-URL's worden ondersteund."
    );
  }

  if (url.username || url.password) {
    throw new ExternalFetchError(
      "invalid_url",
      "URL's met inloggegevens worden niet ondersteund."
    );
  }

  return url;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "TimeoutError" || error.name === "AbortError";
}

/** Reads the body with a hard 5 MB cap, counting bytes as they stream in. */
async function readCappedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    throw new ExternalFetchError(
      "too_large",
      "De template is groter dan 5 MB."
    );
  }

  const body = response.body;
  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        throw new ExternalFetchError(
          "too_large",
          "De template is groter dan 5 MB."
        );
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged);
}

/**
 * Fetches an external HTML document.
 *
 * Resolves to the decoded body plus the URL it ended up on (after redirects).
 * Every failure path throws an {@link ExternalFetchError} with a `code` the
 * caller can map to an HTTP status.
 */
export async function fetchExternalHtml(
  rawUrl: string
): Promise<{ html: string; finalUrl: string }> {
  let url = parseUrl(rawUrl);
  // One shared deadline across all hops, so a redirect chain can't stall us
  // for 4 x 10s.
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertHostAllowed(url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        },
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new ExternalFetchError(
          "timeout",
          "De URL reageerde niet binnen 10 seconden."
        );
      }
      throw new ExternalFetchError(
        "fetch_failed",
        "De URL kon niet worden opgehaald."
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});

      if (!location) {
        throw new ExternalFetchError(
          "http_error",
          `De URL antwoordde met status ${response.status} zonder doorverwijzing.`,
          response.status
        );
      }
      if (hop === MAX_REDIRECTS) {
        throw new ExternalFetchError(
          "http_error",
          "De URL verwijst te vaak door (meer dan 3 keer).",
          response.status
        );
      }

      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        throw new ExternalFetchError(
          "invalid_url",
          "De doorverwijzing van de URL is ongeldig."
        );
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new ExternalFetchError(
          "blocked_host",
          "De URL verwijst door naar een niet-ondersteund protocol."
        );
      }
      if (next.username || next.password) {
        throw new ExternalFetchError(
          "invalid_url",
          "De doorverwijzing bevat inloggegevens."
        );
      }

      url = next;
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new ExternalFetchError(
        "http_error",
        `De URL antwoordde met status ${response.status}.`,
        response.status
      );
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      await response.body?.cancel().catch(() => {});
      throw new ExternalFetchError(
        "not_html",
        "De URL levert geen HTML op."
      );
    }

    let html: string;
    try {
      html = await readCappedText(response);
    } catch (error) {
      if (error instanceof ExternalFetchError) {
        throw error;
      }
      if (isTimeoutError(error)) {
        throw new ExternalFetchError(
          "timeout",
          "De URL reageerde niet binnen 10 seconden."
        );
      }
      throw new ExternalFetchError(
        "fetch_failed",
        "De inhoud van de URL kon niet worden gelezen."
      );
    }

    // text/plain is allowed because raw file hosts (raw.githubusercontent.com
    // and friends) serve .html that way, but the body still has to look like
    // markup — otherwise a JSON or text file would import as a template.
    if (!contentType.includes("text/html") && !looksLikeHtml(html)) {
      throw new ExternalFetchError(
        "not_html",
        "De inhoud van deze URL lijkt geen HTML te zijn."
      );
    }

    return { html, finalUrl: url.toString() };
  }

  throw new ExternalFetchError(
    "http_error",
    "De URL verwijst te vaak door (meer dan 3 keer)."
  );
}
