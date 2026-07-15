import { ROLES } from "@/lib/constants";

export const EDITABLE_STATUSES = ["draft", "b2b_changes_requested", "md_changes_requested"];

export const LOCKED_STATUSES = [
  "submitted_b2b",
  "submitted_md",
  "b2b_approved",
  "md_approved",
  "finalized",
  "retail_allocation",
  "executive_allocation",
  "reconciliation_failed",
  "completed",
];

const ACTION_FROM_STATUSES = {
  submit_b2b: ["draft", "b2b_changes_requested", "md_changes_requested"],
  b2b_approve: ["submitted_b2b"],
  b2b_request_changes: ["submitted_b2b"],
  md_approve: ["submitted_md", "b2b_approved"],
  md_request_changes: ["submitted_md", "b2b_approved"],
  finalize: ["md_approved"],
  start_retail: ["finalized"],
};

export const MD_QUEUE_STATUSES = ["submitted_md", "b2b_approved"];
export const B2B_QUEUE_STATUSES = ["submitted_b2b"];

export function isAwaitingMDApproval(status) {
  return MD_QUEUE_STATUSES.includes(status);
}

export function isAwaitingB2BReview(status) {
  return status === "submitted_b2b";
}

export function isPlanEditable(status) {
  return EDITABLE_STATUSES.includes(status);
}

export function getWorkflowProgress(status) {
  const order = [
    "draft",
    "submitted_b2b",
    "b2b_changes_requested",
    "b2b_approved",
    "submitted_md",
    "md_changes_requested",
    "md_approved",
    "finalized",
    "retail_allocation",
    "executive_allocation",
    "reconciliation_failed",
    "completed",
  ];

  const normalizedStatus =
    status === "b2b_changes_requested" ? "submitted_b2b" :
    status === "md_changes_requested" ? "submitted_md" :
    status === "reconciliation_failed" ? "executive_allocation" :
    status;

  const index = order.indexOf(normalizedStatus);
  return Math.max(0, index);
}

export function getAvailableActions(status, role) {
  const actions = [];

  if (role === ROLES.DEMAND_SUPPLY) {
    if (["draft", "b2b_changes_requested", "md_changes_requested"].includes(status)) {
      actions.push({ action: "submit_b2b", label: "Submit for Review" });
    }
    if (status === "md_approved") {
      actions.push({ action: "finalize", label: "Finalize Plan" });
    }
  }

  if (role === ROLES.B2B_DIRECTOR && status === "submitted_b2b") {
    actions.push(
      { action: "b2b_approve", label: "Approve" },
      { action: "b2b_request_changes", label: "Request Changes" }
    );
  }

  if (role === ROLES.MANAGING_DIRECTOR && isAwaitingMDApproval(status)) {
    actions.push(
      { action: "md_approve", label: "Approve" },
      { action: "md_request_changes", label: "Request Changes" }
    );
  }

  if (role === ROLES.NPM && status === "finalized") {
    actions.push({ action: "start_retail", label: "Mark Retail Allocation Complete" });
  }

  if (role === ROLES.BRANCH_MANAGER && ["retail_allocation", "executive_allocation", "reconciliation_failed"].includes(status)) {
    actions.push({ action: "run_reconciliation", label: "Run Reconciliation" });
  }

  return actions;
}

export function canPerformAction(action, currentStatus, role) {
  const fromStatuses = ACTION_FROM_STATUSES[action];
  if (!fromStatuses?.includes(currentStatus)) {
    return false;
  }
  return getAvailableActions(currentStatus, role).some((a) => a.action === action);
}

export function getNextStatus(action, currentStatus) {
  const transitions = {
    submit_b2b: "submitted_b2b",
    b2b_approve: "submitted_md",
    b2b_request_changes: "b2b_changes_requested",
    md_approve: "md_approved",
    md_request_changes: "md_changes_requested",
    finalize: "finalized",
    start_retail: "retail_allocation",
    complete_executive: "executive_allocation",
    reconciliation_pass: "completed",
    reconciliation_fail: "reconciliation_failed",
  };

  return transitions[action] || currentStatus;
}

export async function calculateReconciliation(supabase, planningPeriodId) {
  const { data: targets } = await supabase
    .from("targets")
    .select("id, sales_group, target_units")
    .eq("planning_period_id", planningPeriodId);

  const retailTargetIds = (targets || [])
    .filter((t) => t.sales_group === "Retail")
    .map((t) => t.id);

  let modelSum = 0;
  if (retailTargetIds.length > 0) {
    const { data: modelAllocs } = await supabase
      .from("model_allocations")
      .select("units")
      .in("target_id", retailTargetIds);

    modelSum = (modelAllocs || []).reduce((sum, m) => sum + m.units, 0);
  }

  const { data: officeAllocs } = await supabase
    .from("sales_office_allocations")
    .select("units")
    .eq("planning_period_id", planningPeriodId);

  const officeSum = (officeAllocs || []).reduce((sum, o) => sum + o.units, 0);

  const { data: offices } = await supabase
    .from("sales_office_allocations")
    .select("id")
    .eq("planning_period_id", planningPeriodId);

  const officeIds = (offices || []).map((o) => o.id);
  let executiveSum = 0;

  if (officeIds.length > 0) {
    const { data: execAllocs } = await supabase
      .from("executive_allocations")
      .select("units, sales_office_allocation_id")
      .in("sales_office_allocation_id", officeIds);

    executiveSum = (execAllocs || []).reduce((sum, e) => sum + e.units, 0);
  }

  const modelOfficeMatch = modelSum === officeSum;
  const officeExecutiveMatch = officeSum === executiveSum;
  const passed = modelOfficeMatch && officeExecutiveMatch;

  return {
    modelSum,
    officeSum,
    executiveSum,
    modelOfficeMatch,
    officeExecutiveMatch,
    passed,
    variance: modelSum - officeSum,
    executiveVariance: officeSum - executiveSum,
  };
}

export async function logAudit(supabase, { userId, action, entityType, entityId, details, planningPeriodId }) {
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details || {},
    planning_period_id: planningPeriodId,
  });
}

export async function repairLegacyPlanStatuses(supabase) {
  await supabase
    .from("planning_periods")
    .update({ status: "submitted_md" })
    .eq("status", "b2b_approved");
}


export async function notifyUsers(supabase, { role, type, message, planningPeriodId }) {
  const { data: users } = await supabase.from("users").select("id").eq("role", role);

  for (const u of users || []) {
    await supabase.from("notifications").insert({
      user_id: u.id,
      type,
      message,
      planning_period_id: planningPeriodId,
    });
  }
}
