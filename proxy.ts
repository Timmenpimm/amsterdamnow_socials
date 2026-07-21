import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

import { auth } from "@/auth";

/**
 * Protects /dashboard/* routes. Unauthenticated users are redirected to
 * /login with a callbackUrl so they land back where they started.
 *
 * Note: Next.js 16 renamed the `middleware` file convention to `proxy`.
 * This performs an optimistic session check only (JWT cookie presence);
 * routes and Server Actions still verify the session themselves.
 */
export default auth((request: NextAuthRequest) => {
  const isLoggedIn = Boolean(request.auth);
  const { pathname } = request.nextUrl;

  if (!isLoggedIn && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
