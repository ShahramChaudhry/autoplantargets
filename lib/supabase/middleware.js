import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];
const LEGACY_REDIRECTS = {
  "/approvals/b2b": "/review-queue",
  "/approvals/md": "/approval-queue",
  "/finalize": "/workflow-status",
  "/reconciliation": "/executive-allocations",
  "/planning-periods": "/monthly-target-plans",
};

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isRoot = pathname === "/";

  if (!user && !isLoginPage && !isApiRoute && !isRoot) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && LEGACY_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_REDIRECTS[pathname];
    return NextResponse.redirect(url);
  }

  if (user && !isApiRoute && !isLoginPage && !isRoot) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role && !canAccessRoute(profile.role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
