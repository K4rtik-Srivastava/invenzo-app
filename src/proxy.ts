import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// A quick, optimistic check that runs before every page: visitors without a
// login cookie are sent to /login. The real checks (is the session valid,
// is the user active, do they have permission) happen on the server, next
// to the data, in src/server/session.ts and src/server/action.ts.
const PUBLIC_PATHS = ["/login", "/setup", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = Boolean(getSessionCookie(request));

  // Data endpoints answer "not signed in" instead of redirecting to a web page.
  if (pathname.startsWith("/api/")) {
    return hasSession ? NextResponse.next() : NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  if (!isPublic && !hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip the auth API, Next.js internals and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
