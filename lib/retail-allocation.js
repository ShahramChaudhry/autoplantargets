export const RETAIL_ALLOCATION_LOCK_MESSAGE =
  "Retail allocation has been completed and is now locked.";

export const EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE =
  "Executive allocation is not available until retail allocation is complete.";

export function getRetailAllocationProgress(retailTarget, allocated) {
  const remaining = retailTarget - allocated;
  const isFullyAllocated = retailTarget > 0 && allocated === retailTarget;
  const isOverAllocated = allocated > retailTarget;

  return {
    retailTarget,
    allocated,
    remaining,
    isFullyAllocated,
    isOverAllocated,
    isIncomplete: retailTarget > 0 && allocated < retailTarget,
  };
}

export function isRetailAllocationEditable(status) {
  return status === "finalized";
}

export function isRetailAllocationCompleteStatus(status) {
  return ["retail_allocation", "executive_allocation", "reconciliation_failed", "completed"].includes(
    status
  );
}

export function isExecutiveAllocationAllowed(status) {
  return isRetailAllocationCompleteStatus(status);
}

export async function fetchRetailAllocationTotals(supabase, planningPeriodId) {
  const { data: retailTargets } = await supabase
    .from("targets")
    .select("target_units, sales_office")
    .eq("planning_period_id", planningPeriodId)
    .eq("sales_group", "Retail");

  const { data: offices } = await supabase
    .from("sales_office_allocations")
    .select("units, sales_office")
    .eq("planning_period_id", planningPeriodId);

  // D&S model totals only (no sales office)
  const retailTarget = (retailTargets || [])
    .filter((t) => !t.sales_office)
    .reduce((sum, target) => sum + target.target_units, 0);

  // Prefer office allocation table; fall back to office-scoped target sum
  let allocated = (offices || []).reduce((sum, office) => sum + office.units, 0);
  if (allocated === 0) {
    allocated = (retailTargets || [])
      .filter((t) => t.sales_office)
      .reduce((sum, target) => sum + target.target_units, 0);
  }

  return {
    retailTarget,
    allocated,
    officeCount: (offices || []).length,
    offices: offices || [],
  };
}

export async function validateRetailAllocationComplete(supabase, planningPeriodId) {
  const { retailTarget, allocated, officeCount } = await fetchRetailAllocationTotals(
    supabase,
    planningPeriodId
  );

  if (retailTarget === 0) {
    return { error: "No retail target has been set for this plan." };
  }

  if (officeCount === 0) {
    return { error: "At least one sales office allocation is required." };
  }

  if (allocated !== retailTarget) {
    const remaining = retailTarget - allocated;
    const detail =
      remaining > 0
        ? `${remaining.toLocaleString()} units remain unallocated.`
        : `${Math.abs(remaining).toLocaleString()} units over-allocated.`;
    return {
      error: `All retail target units must be allocated before completion. ${detail}`,
    };
  }

  return { retailTarget, allocated, officeCount };
}

export async function assertRetailAllocationEditable(supabase, periodId) {
  if (!periodId) {
    return { error: "Plan not found" };
  }

  const { data: period } = await supabase
    .from("planning_periods")
    .select("id, status, month, year")
    .eq("id", periodId)
    .single();

  if (!period) {
    return { error: "Plan not found" };
  }

  if (!isRetailAllocationEditable(period.status)) {
    return { error: RETAIL_ALLOCATION_LOCK_MESSAGE };
  }

  return { period };
}
