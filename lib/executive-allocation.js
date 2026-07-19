import {
  getDivisionsForUser,
  getUnionOfficesForUser,
  getSalesExecutives,
  normalizeOffice,
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

/**
 * Canonical office names where NPM saved leaf targets (units > 0) for this plan.
 */
export function getNpmAllocatedOfficeNames(targets) {
  const names = new Set();
  for (const row of targets || []) {
    if (!row?.sales_office) continue;
    if ((Number(row.target_units) || 0) <= 0) continue;
    names.add(row.sales_office);
  }
  return [...names];
}

/**
 * Dropdown offices for BM: same full sales-office list NPM uses (demo).
 * Prefer every master-data office in scope so BM can reach each NPM row.
 */
export function getOfficesForBranchManagerPanel(user, targets) {
  const master = getUnionOfficesForUser(user, getDivisionsForUser(user));
  const allocated = getNpmAllocatedOfficeNames(targets);

  // Demo: always show the full master list NPM can allocate to
  if (master.length > 0) {
    const seen = new Set(master.map((o) => o.name));
    // Append any leftover NPM office names not in master (legacy)
    const extras = allocated
      .filter((name) => !seen.has(name))
      .map((name) => normalizeOffice(name));
    return [...master, ...extras];
  }

  return allocated.map((name) => normalizeOffice(name));
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
