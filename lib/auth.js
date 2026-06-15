import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";

export async function getCurrentUser() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return profile;
}

export const ROUTE_PERMISSIONS = {
  "/dashboard": Object.values(ROLES),
  "/monthly-target-plans": [ROLES.DEMAND_SUPPLY],
  "/targets": [ROLES.DEMAND_SUPPLY],
  "/model-allocations": [ROLES.DEMAND_SUPPLY],
  "/article-allocations": [ROLES.DEMAND_SUPPLY],
  "/workflow-status": [ROLES.DEMAND_SUPPLY],
  "/audit": [ROLES.DEMAND_SUPPLY],
  "/review-queue": [ROLES.B2B_DIRECTOR],
  "/approval-queue": [ROLES.MANAGING_DIRECTOR],
  "/retail-allocations": [ROLES.NPM],
  "/executive-allocations": [ROLES.BRANCH_MANAGER],
  "/notifications": Object.values(ROLES),
};

const ROLE_NAV_ITEMS = {
  [ROLES.DEMAND_SUPPLY]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/monthly-target-plans", label: "Monthly Target Plans", icon: "Calendar" },
    { href: "/targets", label: "Target Creation", icon: "Target" },
    { href: "/model-allocations", label: "Model Allocation", icon: "Car" },
    { href: "/article-allocations", label: "Article Allocation", icon: "Package" },
    { href: "/workflow-status", label: "Review & Submit", icon: "Activity" },
    { href: "/audit", label: "Audit History", icon: "History" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
  ],
  [ROLES.B2B_DIRECTOR]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/review-queue", label: "Review Queue", icon: "ClipboardList" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
  ],
  [ROLES.MANAGING_DIRECTOR]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/approval-queue", label: "Approval Queue", icon: "Shield" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
  ],
  [ROLES.NPM]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/retail-allocations", label: "Sales Office Allocation", icon: "Building2" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
  ],
  [ROLES.BRANCH_MANAGER]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/executive-allocations", label: "Executive Allocation", icon: "Users" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
  ],
};

export function canAccessRoute(role, pathname) {
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return roles.includes(role);
    }
  }

  return false;
}

export function getNavItems(role) {
  return ROLE_NAV_ITEMS[role] || [];
}

export async function requirePageAccess(pathname) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!canAccessRoute(user.role, pathname)) {
    redirect("/dashboard");
  }

  return user;
}
