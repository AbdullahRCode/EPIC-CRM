import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options } as never);
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options } as never);
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: "", ...options } as never);
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options } as never);
        },
      },
    }
  );

  // getUser() validates the JWT with the Supabase Auth server — never trust
  // the cookie payload (getSession) for role decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Always allow: login page, API routes (route-level guards), static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next")
  ) {
    return response;
  }

  // Not logged in → go to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role lives in app_metadata — only the service role can write it.
  const role = user.app_metadata?.role ?? "employee";

  // Employee trying to access dashboard → redirect to intake
  if (role === "employee" && !pathname.startsWith("/intake")) {
    return NextResponse.redirect(new URL("/intake", request.url));
  }

  // Settings is admin-only — owners are redirected server-side, not just
  // de-linked in the UI (hiding a nav item is not a security boundary).
  if (pathname.startsWith("/settings") && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Intake is open to all roles (owner/admin land on the dashboard by
  // default but may use the intake screen).

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
