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
    { href: "/monthly-planning", label: "Monthly Planning", icon: "Calendar" },
  ],
  [ROLES.B2B_DIRECTOR]: [
    { href: "/approvals", label: "Approvals", icon: "ClipboardList" },
  ],
  [ROLES.MANAGING_DIRECTOR]: [
    { href: "/approvals", label: "Approvals", icon: "Shield" },
  ],
  [ROLES.NPM]: [
    { href: "/allocations", label: "Allocations", icon: "Building2" },
  ],
  [ROLES.BRANCH_MANAGER]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/allocations", label: "Allocations", icon: "Users" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
  ],
  [ROLES.IT_ADMIN]: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/administration", label: "Administration", icon: "Settings" },
    { href: "/audit", label: "Audit History", icon: "History" },
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
    const fallback =
      user.role === ROLES.DEMAND_SUPPLY
        ? "/monthly-planning"
        : user.role === ROLES.B2B_DIRECTOR || user.role === ROLES.MANAGING_DIRECTOR
          ? "/approvals"
          : user.role === ROLES.NPM
            ? "/allocations"
            : "/dashboard";
    redirect(fallback);
  }

  return user;
}
