import { ROLES } from "@/lib/constants";

const APPROVER_ROLES = [ROLES.B2B_DIRECTOR, ROLES.MANAGING_DIRECTOR];
const ALLOCATOR_ROLES = [ROLES.NPM, ROLES.BRANCH_MANAGER];

export const ROUTE_PERMISSIONS = {
  "/monthly-planning": [ROLES.DEMAND_SUPPLY],
  "/approvals": APPROVER_ROLES,
  "/allocations": ALLOCATOR_ROLES,

  // Legacy routes — still gated so middleware redirects work correctly
  "/monthly-target-plans": [ROLES.DEMAND_SUPPLY],
  "/targets": [ROLES.DEMAND_SUPPLY],
  "/model-allocations": [ROLES.DEMAND_SUPPLY],
  "/article-allocations": [ROLES.DEMAND_SUPPLY],
  "/workflow-status": [ROLES.DEMAND_SUPPLY],
  "/review-queue": [ROLES.B2B_DIRECTOR],
  "/approval-queue": [ROLES.MANAGING_DIRECTOR],
  "/retail-allocations": [ROLES.NPM],
  "/executive-allocations": [ROLES.BRANCH_MANAGER],
  "/finalize": [ROLES.DEMAND_SUPPLY],
  "/reconciliation": [ROLES.BRANCH_MANAGER],
  "/planning-periods": [ROLES.DEMAND_SUPPLY],
};

/** Home page for each role (each role has a single primary view). */
export function getHomePathForRole(role) {
  if (role === ROLES.DEMAND_SUPPLY) return "/monthly-planning";
  if (role === ROLES.B2B_DIRECTOR || role === ROLES.MANAGING_DIRECTOR) return "/approvals";
  if (role === ROLES.NPM || role === ROLES.BRANCH_MANAGER) return "/allocations";
  return "/login";
}

export function canAccessRoute(role, pathname) {
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return roles.includes(role);
    }
  }
  return false;
}
