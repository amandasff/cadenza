import { NextRequest, NextResponse } from "next/server";

/**
 * On the cadenza.social domain, rewrite bare /{username} paths to /p/{username}
 * so that public profile links work without the /p/ prefix.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!host.includes("cadenza.social")) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Skip paths that already match real routes or static assets
  if (
    pathname.startsWith("/p/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rewrite /amanda → /p/amanda
  const url = request.nextUrl.clone();
  url.pathname = `/p${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
