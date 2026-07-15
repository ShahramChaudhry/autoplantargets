import { ROLES } from "@/lib/constants";

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

export function canAccessRoute(role, pathname) {
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return roles.includes(role);
    }
  }
  return false;
}
