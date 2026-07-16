export const EXEC_ALLOCATION_LOCKED_MESSAGE =
  "Sales executive allocation is locked for this plan.";

/** Plan statuses where Branch Manager may edit Exec × Sales Group allocations. */
export function isExecutiveAllocationEditable(status) {
  return (
    status === "retail_allocation" ||
    status === "executive_allocation" ||
    status === "reconciliation_failed"
  );
}

export function isExecutiveAllocationCompleteStatus(status) {
  return status === "completed";
}
