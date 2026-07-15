import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/route-permissions";
import { SESSION_COOKIE, decodeSession } from "@/lib/local-db/session";

const LEGACY_REDIRECTS = {
  "/approvals/b2b": "/review-queue",
  "/approvals/md": "/approval-queue",
  "/finalize": "/workflow-status",
  "/reconciliation": "/executive-allocations",
  "/planning-periods": "/monthly-target-plans",
};

export async function updateSession(request) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = decodeSession(token);

  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isRoot = pathname === "/";
  const isAuthApi = pathname.startsWith("/api/auth/");

  if (!session && !isLoginPage && !isApiRoute && !isRoot) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (session && LEGACY_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_REDIRECTS[pathname];
    return NextResponse.redirect(url);
  }

  if (session && !isApiRoute && !isLoginPage && !isRoot) {
    if (session.role && !canAccessRoute(session.role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Allow unauthenticated calls to auth APIs
  if (!session && isApiRoute && !isAuthApi && pathname.startsWith("/api/dev/")) {
    // switch-user handles its own auth in route
  }

  return NextResponse.next({ request });
}
