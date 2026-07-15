import { ROLES } from "@/lib/constants";

const ALL_ROLES = Object.values(ROLES);
const APPROVER_ROLES = [ROLES.B2B_DIRECTOR, ROLES.MANAGING_DIRECTOR];
const ALLOCATOR_ROLES = [ROLES.NPM, ROLES.BRANCH_MANAGER];
const AUDIT_ROLES = [ROLES.IT_ADMIN];
const NOTIFICATION_ROLES = [
  ROLES.BRANCH_MANAGER,
  ROLES.IT_ADMIN,
];

export const ROUTE_PERMISSIONS = {
  "/dashboard": ALL_ROLES.filter(
    (r) =>
      r !== ROLES.DEMAND_SUPPLY &&
      r !== ROLES.B2B_DIRECTOR &&
      r !== ROLES.MANAGING_DIRECTOR &&
      r !== ROLES.NPM
  ),
  "/monthly-planning": [ROLES.DEMAND_SUPPLY],
  "/approvals": APPROVER_ROLES,
  "/allocations": ALLOCATOR_ROLES,
  "/audit": AUDIT_ROLES,
  "/notifications": NOTIFICATION_ROLES,
  "/administration": [ROLES.IT_ADMIN],

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

export function canAccessRoute(role, pathname) {
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return roles.includes(role);
    }
  }
  return false;
}
