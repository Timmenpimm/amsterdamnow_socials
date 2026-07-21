import "server-only";

import crypto from "node:crypto";

import { describeFetchError, withTimeout } from "@/lib/connections/shared";

/**
 * Facebook Login for Business OAuth flow for Instagram (Graph API v21.0).
 *
 * Flow (see app/api/instagram/oauth/{start,callback}/route.ts):
 *  1. buildAuthorizeUrl() -> redirect the user to Meta's OAuth dialog.
 *  2. Meta redirects back with ?code=&state=.
 *  3. exchangeCodeForToken() -> short-lived user access token.
 *  4. exchangeForLongLivedToken() -> long-lived (~60 day) user access token.
 *  5. discoverInstagramAccount() -> find the Facebook Page (and its
 *     never-expiring Page access token) that has a linked Instagram
 *     business account.
 *
 * The resulting { pageAccessToken, igBusinessAccountId, igUsername } maps
 * 1:1 onto the existing InstagramConnection fields (accessToken,
 * businessAccountId, igUsername) already used by lib/connections/instagram.ts
 * and the publish engine (lib/instagram.ts / lib/instagram-publish.ts) — the
 * OAuth flow is just an alternate way to populate that same storage.
 *
 * Never log tokens or the app secret — only Meta's error message/code.
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const OAUTH_DIALOG_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

const OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "business_management",
  "pages_read_engagement",
].join(",");

/** How long a signed OAuth state is valid for — just long enough for the redirect round-trip to Meta and back. */
const STATE_MAX_AGE_MS = 5 * 60 * 1000;

export class MissingMetaConfigError extends Error {
  constructor() {
    super(
      "META_APP_ID/META_APP_SECRET (or PUBLIC_BASE_URL/AUTH_URL for the redirect URI) are not configured."
    );
    this.name = "MissingMetaConfigError";
  }
}

export class MetaOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaOAuthError";
  }
}

export class NoInstagramBusinessAccountError extends Error {
  constructor() {
    super(
      "No Facebook Page with a linked Instagram business account was found for this login."
    );
    this.name = "NoInstagramBusinessAccountError";
  }
}

function getMetaConfig(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new MissingMetaConfigError();
  }

  return { appId, appSecret };
}

/**
 * The callback URL Meta redirects back to. Derived from PUBLIC_BASE_URL (or
 * AUTH_URL as a fallback) — this exact URL must be listed under "Valid
 * OAuth Redirect URIs" in the Meta App's Facebook Login for Business
 * product settings.
 */
export function getRedirectUri(): string {
  const base = process.env.PUBLIC_BASE_URL || process.env.AUTH_URL;

  if (!base) {
    throw new MissingMetaConfigError();
  }

  return `${base.replace(/\/+$/, "")}/api/instagram/oauth/callback`;
}

/** Builds the Facebook OAuth dialog URL the user is redirected to. */
export function buildAuthorizeUrl(state: string): string {
  const { appId } = getMetaConfig();
  const redirectUri = getRedirectUri();

  const url = new URL(OAUTH_DIALOG_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("state", state);

  return url.toString();
}

interface GraphErrorResponse {
  error?: { message?: string; code?: number; fbtrace_id?: string };
}

/** Shared GET helper for the OAuth token/discovery endpoints — never surfaces the raw response, only Meta's error message. */
async function graphGet<T>(url: URL): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal: withTimeout() });
  } catch (error) {
    throw new MetaOAuthError(describeFetchError(error));
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new MetaOAuthError(
      `Meta returned a non-JSON response (status ${response.status}).`
    );
  }

  const body = data as GraphErrorResponse;
  if (!response.ok || body.error) {
    throw new MetaOAuthError(
      body.error?.message ?? `Meta responded with status ${response.status}.`
    );
  }

  return data as T;
}

/** Exchanges the OAuth `code` for a short-lived user access token. */
export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string }> {
  const { appId, appSecret } = getMetaConfig();
  const redirectUri = getRedirectUri();

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const data = await graphGet<{ access_token?: string }>(url);
  if (!data.access_token) {
    throw new MetaOAuthError("Meta did not return an access token for this code.");
  }

  return { accessToken: data.access_token };
}

/** Exchanges a short-lived user token for a long-lived one (~60 days). */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string }> {
  const { appId, appSecret } = getMetaConfig();

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const data = await graphGet<{ access_token?: string }>(url);
  if (!data.access_token) {
    throw new MetaOAuthError("Meta did not return a long-lived access token.");
  }

  return { accessToken: data.access_token };
}

interface GraphPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

export interface DiscoveredInstagramAccount {
  /** Page access token derived from a long-lived user token — does not expire. Store this as InstagramConnection.accessToken. */
  pageAccessToken: string;
  igBusinessAccountId: string;
  igUsername: string | null;
}

/**
 * Finds the Facebook Page (among those the logged-in user manages) that has
 * a linked Instagram business account.
 *
 * MVP note: if the user manages multiple Pages with a linked IG account,
 * this takes the *first* one Meta returns and ignores the rest. Revisit
 * with an account-picker UI if multi-page support is ever needed.
 */
export async function discoverInstagramAccount(
  longLivedUserToken: string
): Promise<DiscoveredInstagramAccount> {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}"
  );
  url.searchParams.set("access_token", longLivedUserToken);

  const data = await graphGet<{ data?: GraphPage[] }>(url);
  const pageWithInstagram = (data.data ?? []).find(
    (page) => page.instagram_business_account?.id
  );

  if (!pageWithInstagram?.instagram_business_account) {
    throw new NoInstagramBusinessAccountError();
  }

  return {
    pageAccessToken: pageWithInstagram.access_token,
    igBusinessAccountId: pageWithInstagram.instagram_business_account.id,
    igUsername: pageWithInstagram.instagram_business_account.username ?? null,
  };
}

function getStateSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      "No secret available to sign the OAuth state. Set AUTH_SECRET (or ENCRYPTION_KEY)."
    );
  }

  return secret;
}

function hmacHex(payloadB64Url: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadB64Url).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Signs a CSRF state token binding the OAuth round-trip to the currently
 * logged-in user: HMAC-SHA256 over a small `{ uid, ts }` payload, secret
 * from AUTH_SECRET (or ENCRYPTION_KEY as a fallback). Verified by
 * verifyState() when Meta redirects back.
 */
export function signState(userId: string): string {
  const secret = getStateSecret();
  const payloadB64 = Buffer.from(
    JSON.stringify({ uid: userId, ts: Date.now() }),
    "utf8"
  ).toString("base64url");

  return `${payloadB64}.${hmacHex(payloadB64, secret)}`;
}

/** Verifies a state token produced by signState(): signature, matching user, and not expired. */
export function verifyState(state: string, userId: string): boolean {
  try {
    const secret = getStateSecret();
    const [payloadB64, signature] = state.split(".");
    if (!payloadB64 || !signature) return false;

    if (!safeEqualHex(signature, hmacHex(payloadB64, secret))) return false;

    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as { uid?: unknown; ts?: unknown };

    if (typeof parsed.uid !== "string" || parsed.uid !== userId) return false;
    if (typeof parsed.ts !== "number") return false;

    const age = Date.now() - parsed.ts;
    return age >= 0 && age <= STATE_MAX_AGE_MS;
  } catch {
    return false;
  }
}
