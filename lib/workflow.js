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

/** Plans B2B can browse (submitted to them or further along — not unsent drafts). */
export const B2B_VISIBLE_STATUSES = [
  "submitted_b2b",
  "b2b_changes_requested",
  "submitted_md",
  "b2b_approved",
  "md_changes_requested",
  "md_approved",
  "finalized",
  "retail_allocation",
  "executive_allocation",
  "reconciliation_failed",
  "completed",
];

/** Plans MD can browse (reached MD queue or further along). */
export const MD_VISIBLE_STATUSES = [
  "submitted_md",
  "b2b_approved",
  "md_changes_requested",
  "md_approved",
  "finalized",
  "retail_allocation",
  "executive_allocation",
  "reconciliation_failed",
  "completed",
];

export function isAwaitingMDApproval(status) {
  return MD_QUEUE_STATUSES.includes(status);
}

export function isAwaitingB2BReview(status) {
  return status === "submitted_b2b";
}

export function isVisibleToB2B(status) {
  return B2B_VISIBLE_STATUSES.includes(status);
}

export function isVisibleToMD(status) {
  return MD_VISIBLE_STATUSES.includes(status);
}

export function isVisibleToApprover(role, status) {
  if (role === ROLES.MANAGING_DIRECTOR) return isVisibleToMD(status);
  if (role === ROLES.B2B_DIRECTOR) return isVisibleToB2B(status);
  return false;
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

export { calculateReconciliation } from "@/lib/reconciliation";

export async function logAudit(supabase, { userId, action, entityType, entityId, details, planningPeriodId }) {
  const payload = {
    user_id: userId || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details || {},
    planning_period_id: planningPeriodId,
  };

  const { error } = await supabase.from("audit_logs").insert(payload);
  if (error) {
    // Demo cookie-auth user IDs may not exist in public.users — retry without user_id
    const { error: retryError } = await supabase.from("audit_logs").insert({
      ...payload,
      user_id: null,
    });
    if (retryError) {
      console.error("logAudit failed:", retryError.message);
    }
  }
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
