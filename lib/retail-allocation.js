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

function isDsModelRow(t) {
  return t.model && !t.sales_office && !t.article_code;
}

function isLeafOfficeRow(t) {
  return Boolean(t.sales_office && t.model);
}

/**
 * Sum leaf office allocations for one model.
 * Exclusive source: article leaves if any exist with units; otherwise model×office leaves.
 * Does not force article mode merely because master data lists article codes.
 */
export function sumModelOfficeLeaves(targets, brand, salesGroup, model) {
  const rows = (targets || []).filter(
    (t) =>
      t.brand === brand &&
      t.sales_group === salesGroup &&
      t.model === model &&
      isLeafOfficeRow(t)
  );
  const articleSum = rows
    .filter((t) => t.article_code)
    .reduce((sum, t) => sum + (Number(t.target_units) || 0), 0);
  if (articleSum > 0) return articleSum;

  return rows
    .filter((t) => !t.article_code)
    .reduce((sum, t) => sum + (Number(t.target_units) || 0), 0);
}

export async function fetchRetailAllocationTotals(supabase, planningPeriodId) {
  const { data: retailTargets } = await supabase
    .from("targets")
    .select("target_units, sales_office, article_code, model, brand, sales_group")
    .eq("planning_period_id", planningPeriodId)
    .eq("sales_group", "Retail");

  const { data: offices } = await supabase
    .from("sales_office_allocations")
    .select("units, sales_office")
    .eq("planning_period_id", planningPeriodId);

  const modelLevel = (retailTargets || []).filter(isDsModelRow);
  const brandLevel = (retailTargets || []).filter(
    (t) => !t.sales_office && !t.article_code && !t.model
  );

  const retailTarget =
    modelLevel.length > 0
      ? modelLevel.reduce((sum, target) => sum + target.target_units, 0)
      : brandLevel.reduce((sum, target) => sum + target.target_units, 0);

  // Prefer sum of leaf office rows (article×office or model×office). Fall back to sync table.
  const leafAllocated = (retailTargets || [])
    .filter(isLeafOfficeRow)
    .reduce((sum, target) => sum + (Number(target.target_units) || 0), 0);
  const officeTableAllocated = (offices || []).reduce(
    (sum, office) => sum + office.units,
    0
  );
  const allocated = leafAllocated > 0 ? leafAllocated : officeTableAllocated;

  return {
    retailTarget,
    allocated,
    officeCount: (offices || []).length,
    offices: offices || [],
    targets: retailTargets || [],
  };
}

export async function validateRetailAllocationComplete(supabase, planningPeriodId) {
  const { retailTarget, allocated, officeCount, targets } =
    await fetchRetailAllocationTotals(supabase, planningPeriodId);

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

  // Per-model roll-up must match each D&S model total (articles → model → brand)
  const dsModels = (targets || []).filter(isDsModelRow);
  for (const row of dsModels) {
    const ds = Number(row.target_units) || 0;
    const rolled = sumModelOfficeLeaves(targets, row.brand, row.sales_group, row.model);
    if (rolled !== ds) {
      return {
        error: `${row.brand} ${row.model}: office allocation ${rolled} must equal D&S total ${ds}.`,
      };
    }
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
