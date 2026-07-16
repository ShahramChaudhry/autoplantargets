export const EXEC_ALLOCATION_LOCKED_MESSAGE =
  "Sales executive allocation is locked for this plan.";

/** Plan statuses where Branch Manager may edit Exec × Model allocations. */
export function isExecutiveAllocationEditable(status) {
  return status === "retail_allocation" || status === "reconciliation_failed";
}

export function isExecutiveAllocationCompleteStatus(status) {
  return ["executive_allocation", "completed"].includes(status);
}
