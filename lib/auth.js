import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";

export async function getCurrentUser() {
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

export function canAccessRoute(role, pathname) {
  const routePermissions = {
    "/dashboard": Object.values(ROLES),
    "/targets": [ROLES.DEMAND_SUPPLY],
    "/model-allocations": [ROLES.DEMAND_SUPPLY],
    "/article-allocations": [ROLES.DEMAND_SUPPLY],
    "/finalize": [ROLES.DEMAND_SUPPLY],
    "/approvals/b2b": [ROLES.B2B_DIRECTOR],
    "/approvals/md": [ROLES.MANAGING_DIRECTOR],
    "/retail-allocations": [ROLES.NPM],
    "/executive-allocations": [ROLES.BRANCH_MANAGER],
    "/reconciliation": [ROLES.BRANCH_MANAGER, ROLES.NPM, ROLES.DEMAND_SUPPLY],
    "/notifications": Object.values(ROLES),
    "/audit": Object.values(ROLES),
  };

  for (const [route, roles] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route)) {
      return roles.includes(role);
    }
  }

  return true;
}

export function getNavItems(role) {
  const allItems = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: Object.values(ROLES) },
    { href: "/targets", label: "Brand Targets", icon: "Target", roles: [ROLES.DEMAND_SUPPLY] },
    { href: "/model-allocations", label: "Model Allocation", icon: "Car", roles: [ROLES.DEMAND_SUPPLY] },
    { href: "/article-allocations", label: "Article Allocation", icon: "Package", roles: [ROLES.DEMAND_SUPPLY] },
    { href: "/approvals/b2b", label: "B2B Approval", icon: "CheckCircle", roles: [ROLES.B2B_DIRECTOR] },
    { href: "/approvals/md", label: "MD Approval", icon: "Shield", roles: [ROLES.MANAGING_DIRECTOR] },
    { href: "/finalize", label: "Finalize Targets", icon: "Lock", roles: [ROLES.DEMAND_SUPPLY] },
    { href: "/retail-allocations", label: "Sales Office Allocation", icon: "Building2", roles: [ROLES.NPM] },
    { href: "/executive-allocations", label: "Executive Allocation", icon: "Users", roles: [ROLES.BRANCH_MANAGER] },
    { href: "/reconciliation", label: "Reconciliation", icon: "Scale", roles: [ROLES.BRANCH_MANAGER, ROLES.NPM, ROLES.DEMAND_SUPPLY] },
    { href: "/notifications", label: "Notifications", icon: "Bell", roles: Object.values(ROLES) },
    { href: "/audit", label: "Audit History", icon: "History", roles: Object.values(ROLES) },
  ];

  return allItems.filter((item) => item.roles.includes(role));
}
