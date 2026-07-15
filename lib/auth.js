import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { ROLES } from "@/lib/constants";
import { readDb } from "@/lib/local-db/store";
import { SESSION_COOKIE, decodeSession } from "@/lib/local-db/session";
import { ROUTE_PERMISSIONS, canAccessRoute } from "@/lib/route-permissions";

export { ROUTE_PERMISSIONS, canAccessRoute };

export async function getCurrentUser() {
  noStore();
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session?.id) return null;

  const db = await readDb();
  const user = db.users.find((u) => u.id === session.id);
  if (!user) return null;

  const { password: _password, ...profile } = user;
  return profile;
}

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
