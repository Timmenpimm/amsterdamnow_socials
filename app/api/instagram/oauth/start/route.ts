import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildAuthorizeUrl,
  MissingMetaConfigError,
  signState,
} from "@/lib/instagram-oauth";

/**
 * GET /api/instagram/oauth/start
 *
 * Entry point for the "Login met Instagram" button. Signs a CSRF state tied
 * to the logged-in user, then 302-redirects to Meta's OAuth dialog. All
 * Graph API / URL-building logic lives in lib/instagram-oauth.ts — this
 * route only handles the session check and error-to-redirect mapping.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const state = signState(userId);
    return NextResponse.redirect(buildAuthorizeUrl(state));
  } catch (error) {
    if (error instanceof MissingMetaConfigError) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?ig_error=not_configured", request.url)
      );
    }

    console.error("Instagram OAuth start failed:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?ig_error=unknown", request.url)
    );
  }
}
