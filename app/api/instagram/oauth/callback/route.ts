import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { saveInstagramConnection } from "@/lib/connections";
import {
  discoverInstagramAccount,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  MetaOAuthError,
  MissingMetaConfigError,
  NoInstagramBusinessAccountError,
  verifyState,
} from "@/lib/instagram-oauth";

/**
 * GET /api/instagram/oauth/callback
 *
 * Meta redirects here with either `?code=&state=` (user approved) or
 * `?error=...` (user cancelled/denied). Verifies the CSRF state against the
 * logged-in user, then runs code -> short-lived token -> long-lived token
 * -> Instagram account discovery, and saves the result via the *existing*
 * InstagramConnection storage (lib/connections/instagram.ts) — the same
 * accessToken/businessAccountId/igUsername fields, AES-encrypted the same
 * way, that the manual form and publish engine already read.
 *
 * Only short, fixed reason codes ever go in the ?ig_error= redirect (or in
 * logs) — never the raw token/secret/Meta error body.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const settingsUrl = (query: string) =>
    new URL(`/dashboard/settings${query}`, request.url);

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(settingsUrl("?ig_error=denied"));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || !verifyState(state, userId)) {
    return NextResponse.redirect(settingsUrl("?ig_error=invalid_state"));
  }

  try {
    const { accessToken: shortLivedToken } = await exchangeCodeForToken(code);
    const { accessToken: longLivedToken } =
      await exchangeForLongLivedToken(shortLivedToken);
    const { pageAccessToken, igBusinessAccountId, igUsername } =
      await discoverInstagramAccount(longLivedToken);

    await saveInstagramConnection(userId, {
      accessToken: pageAccessToken,
      businessAccountId: igBusinessAccountId,
      igUsername: igUsername ?? undefined,
    });

    return NextResponse.redirect(settingsUrl("?ig_connected=1"));
  } catch (error) {
    if (error instanceof MissingMetaConfigError) {
      return NextResponse.redirect(settingsUrl("?ig_error=not_configured"));
    }
    if (error instanceof NoInstagramBusinessAccountError) {
      return NextResponse.redirect(settingsUrl("?ig_error=no_ig_account"));
    }
    if (error instanceof MetaOAuthError) {
      console.error("Instagram OAuth callback failed (Meta error):", error.message);
      return NextResponse.redirect(settingsUrl("?ig_error=meta_error"));
    }

    console.error("Instagram OAuth callback failed:", error);
    return NextResponse.redirect(settingsUrl("?ig_error=unknown"));
  }
}
