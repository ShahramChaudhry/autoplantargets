import {
  getDivisionsForUser,
  getUnionOfficesForUser,
  getSalesExecutives,
} from "@/src/data";
import { isOfficeInScope } from "@/lib/exec-allocation-rollup";
import {
  EXEC_ALLOCATION_LOCKED_MESSAGE,
  isExecutiveAllocationCompleteStatus,
  isExecutiveAllocationEditable,
} from "@/lib/executive-allocation-status";

export {
  EXEC_ALLOCATION_LOCKED_MESSAGE,
  isExecutiveAllocationCompleteStatus,
  isExecutiveAllocationEditable,
};

/** Offices the Branch Manager may access (canonical master-data office names). */
export function getBranchManagerOfficeNames(user) {
  const divisions = getDivisionsForUser(user);
  return getUnionOfficesForUser(user, divisions).map((o) => o.name);
}

export function assertOfficeAccess(user, officeName) {
  const allowed = getBranchManagerOfficeNames(user);
  if (!isOfficeInScope(allowed, officeName)) {
    return { error: "Not permitted to access allocations for this sales office." };
  }
  return { allowed };
}

export function getExecutivesForOffice(user, officeName) {
  const divisions = getDivisionsForUser(user);
  for (const division of divisions) {
    const execs = getSalesExecutives(division, officeName);
    if (execs.length) {
      return execs.map((e) => ({
        id: String(e.id),
        code: String(e.id),
        name: e.name,
        division: division.name,
        active: true,
      }));
    }
  }
  return [];
}
