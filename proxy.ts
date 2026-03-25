import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // cadenza.social/{username} → /p/{username}
  // Only rewrite paths that aren't known app routes
  const APP_PREFIXES = ["/p/", "/api/", "/_next/", "/auth/", "/student", "/teacher", "/parent", "/enroll", "/lesson"];
  const host = request.headers.get("host") ?? "";
  if (host.includes("cadenza.social") && pathname !== "/" && !pathname.includes(".") && !APP_PREFIXES.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = `/p${pathname}`;
    return NextResponse.rewrite(url);
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect /student/* and /teacher/*
  const isProtected = pathname.startsWith("/student") || pathname.startsWith("/teacher");
  if (isProtected && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based guard: fetch profile role
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile) {
      const isStudentRoute = pathname.startsWith("/student");
      const isTeacherRoute = pathname.startsWith("/teacher");
      if (isStudentRoute && profile.role !== "student") {
        return NextResponse.redirect(new URL("/teacher", request.url));
      }
      if (isTeacherRoute && profile.role !== "teacher") {
        return NextResponse.redirect(new URL("/student", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/auth/:path*", "/:path((?!api|_next|p|favicon\\.ico).*)"],
};
