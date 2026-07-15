import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/route-permissions";
import { SESSION_COOKIE, decodeSession } from "@/lib/local-db/session";

const LEGACY_REDIRECTS = {
  "/approvals/b2b": "/approvals",
  "/approvals/md": "/approvals",
  "/review-queue": "/approvals",
  "/approval-queue": "/approvals",
  "/finalize": "/monthly-planning",
  "/reconciliation": "/allocations",
  "/planning-periods": "/monthly-planning",
  "/monthly-target-plans": "/monthly-planning",
  "/targets": "/monthly-planning",
  "/model-allocations": "/monthly-planning",
  "/article-allocations": "/monthly-planning",
  "/workflow-status": "/monthly-planning",
  "/retail-allocations": "/allocations",
  "/executive-allocations": "/allocations",
};

const PLANNING_STEP_REDIRECTS = {
  "/targets": "targets",
  "/model-allocations": "models",
  "/article-allocations": "articles",
  "/workflow-status": "review",
};

function redirectWithPlan(request, pathname, searchParams) {
  const plan = searchParams.get("plan");
  const step = PLANNING_STEP_REDIRECTS[pathname];

  if (step && plan) {
    const url = request.nextUrl.clone();
    url.pathname = `/monthly-planning/${plan}`;
    url.search = `?step=${step}`;
    return NextResponse.redirect(url);
  }

  if (LEGACY_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_REDIRECTS[pathname];
    if (plan && ["/approvals", "/allocations"].includes(LEGACY_REDIRECTS[pathname])) {
      url.search = `?plan=${plan}`;
    } else if (!step) {
      url.search = request.nextUrl.search;
    } else {
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/monthly-target-plans/")) {
    const slug = pathname.replace("/monthly-target-plans/", "");
    const url = request.nextUrl.clone();
    url.pathname = `/monthly-planning/${slug}`;
    return NextResponse.redirect(url);
  }

  return null;
}

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

  if (session) {
    const legacy = redirectWithPlan(request, pathname, request.nextUrl.searchParams);
    if (legacy) return legacy;
  }

  if (session && !isApiRoute && !isLoginPage && !isRoot) {
    if (session.role && !canAccessRoute(session.role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (!session && isApiRoute && !isAuthApi && pathname.startsWith("/api/dev/")) {
    // switch-user handles its own auth in route
  }

  return NextResponse.next({ request });
}
