import { createClient } from "@/lib/supabase/server";
import { findPlanBySlug, planSlug } from "@/lib/plans";
import { STATUS_LABELS, ROLES } from "@/lib/constants";
import {
  repairLegacyPlanStatuses,
  isAwaitingMDApproval,
  isAwaitingB2BReview,
} from "@/lib/workflow";

const SUBMITTED_STATUSES = ["submitted_b2b", "submitted_md", "b2b_approved", "md_approved"];
const RETURNED_STATUSES = ["b2b_changes_requested", "md_changes_requested"];
const COMPLETED_STATUSES = ["completed"];
const MD_APPROVED_AND_BEYOND = [
  "md_approved",
  "finalized",
  "retail_allocation",
  "executive_allocation",
  "reconciliation_failed",
  "completed",
];
const RETAIL_PENDING = ["finalized"];
const RETAIL_DONE = ["retail_allocation", "executive_allocation", "reconciliation_failed", "completed"];
const EXEC_PENDING = ["retail_allocation", "executive_allocation"];

export async function getPlanningPeriods() {
  const supabase = await createClient();
  await repairLegacyPlanStatuses(supabase);

  const { data } = await supabase
    .from("planning_periods")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  return data || [];
}

export async function getActivePlan(planSlugParam) {
  const periods = await getPlanningPeriods();
  if (planSlugParam) {
    return findPlanBySlug(periods, planSlugParam) || periods[0] || null;
  }
  return periods[0] || null;
}

/** Plan that belongs in a role's approval/review queue (falls back to most recent). */
export async function getQueuePlan(role, planSlugParam) {
  const periods = await getPlanningPeriods();

  if (planSlugParam) {
    return findPlanBySlug(periods, planSlugParam) || null;
  }

  if (role === ROLES.MANAGING_DIRECTOR) {
    return periods.find((p) => isAwaitingMDApproval(p.status)) || periods[0] || null;
  }

  if (role === ROLES.B2B_DIRECTOR) {
    return periods.find((p) => isAwaitingB2BReview(p.status)) || periods[0] || null;
  }

  return periods[0] || null;
}

export function queuePlanHref(role, plan) {
  if (!plan) return "/approvals";
  const slug = planSlug(plan.month, plan.year);
  return `/approvals?plan=${slug}`;
}

/** @deprecated Use getActivePlan(planSlug) */
export async function getActivePeriod(periodIdOrSlug) {
  const periods = await getPlanningPeriods();
  if (!periodIdOrSlug) return periods[0] || null;
  return (
    findPlanBySlug(periods, periodIdOrSlug) ||
    periods.find((p) => p.id === periodIdOrSlug) ||
    periods[0] ||
    null
  );
}

export async function getDashboardStats(periodId, userId) {
  const supabase = await createClient();

  const { data: periodTargets } = await supabase
    .from("targets")
    .select("id")
    .eq("planning_period_id", periodId);

  const targetIds = (periodTargets || []).map((t) => t.id);

  const modelQuery = targetIds.length
    ? supabase.from("model_allocations").select("id").in("target_id", targetIds)
    : Promise.resolve({ data: [] });

  const { data: modelRows } = await modelQuery;
  const modelIds = (modelRows || []).map((m) => m.id);

  const [
    { count: targetCount },
    { count: modelCount },
    { count: articleCount },
    { count: officeCount },
    { count: notificationCount },
  ] = await Promise.all([
    supabase.from("targets").select("*", { count: "exact", head: true }).eq("planning_period_id", periodId),
    targetIds.length
      ? supabase.from("model_allocations").select("*", { count: "exact", head: true }).in("target_id", targetIds)
      : Promise.resolve({ count: 0 }),
    modelIds.length
      ? supabase.from("article_allocations").select("*", { count: "exact", head: true }).in("model_allocation_id", modelIds)
      : Promise.resolve({ count: 0 }),
    supabase.from("sales_office_allocations").select("*", { count: "exact", head: true }).eq("planning_period_id", periodId),
    userId
      ? supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "unread")
      : supabase.from("notifications").select("*", { count: "exact", head: true }).eq("status", "unread"),
  ]);

  const { data: targets } = await supabase
    .from("targets")
    .select("target_units, model")
    .eq("planning_period_id", periodId);

  const totalUnits = (targets || []).reduce((s, t) => s + t.target_units, 0);
  const modelTargetCount = (targets || []).filter((t) => t.model && t.target_units > 0).length;

  return {
    targetCount: targetCount || 0,
    modelCount: modelCount || 0,
    modelTargetCount,
    articleCount: articleCount || 0,
    officeCount: officeCount || 0,
    notificationCount: notificationCount || 0,
    totalUnits,
  };
}

export async function getRoleDashboardData(role, periodId, userId) {
  const supabase = await createClient();
  const stats = periodId ? await getDashboardStats(periodId, userId) : null;

  const { data: retailTargets } = periodId
    ? await supabase
        .from("targets")
        .select("target_units")
        .eq("planning_period_id", periodId)
        .eq("sales_group", "Retail")
    : { data: [] };

  const { data: offices } = periodId
    ? await supabase.from("sales_office_allocations").select("id, units").eq("planning_period_id", periodId)
    : { data: [] };

  const officeIds = (offices || []).map((o) => o.id);
  const { data: executives } = officeIds.length
    ? await supabase.from("executive_allocations").select("units").in("sales_office_allocation_id", officeIds)
    : { data: [] };

  const retailTotal = (retailTargets || []).reduce((s, t) => s + t.target_units, 0);
  const officeTotal = (offices || []).reduce((s, o) => s + o.units, 0);
  const execTotal = (executives || []).reduce((s, e) => s + e.units, 0);

  const { data: period } = periodId
    ? await supabase.from("planning_periods").select("status").eq("id", periodId).single()
    : { data: null };

  const periods = await getPlanningPeriods();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todayApprovals } = await supabase
    .from("audit_logs")
    .select("id, created_at")
    .eq("action", "b2b_approve");

  const approvedToday = (todayApprovals || []).filter(
    (log) => log.created_at && new Date(log.created_at) >= startOfDay
  ).length;

  return {
    stats,
    retailTotal,
    officeTotal,
    execTotal,
    pendingReview: periods.some((p) => isAwaitingB2BReview(p.status)),
    pendingApproval: periods.some((p) => isAwaitingMDApproval(p.status)),
    approvedToday,
    returnedPlans: periods.filter((p) => RETURNED_STATUSES.includes(p.status)).length,
    approvedPlans: periods.filter((p) => MD_APPROVED_AND_BEYOND.includes(p.status)).length,
    pendingRetail: periods.filter((p) => RETAIL_PENDING.includes(p.status)).length,
    completedAllocations: periods.filter((p) => RETAIL_DONE.includes(p.status)).length,
    pendingExecutive: periods.filter((p) => EXEC_PENDING.includes(p.status)).length,
    reconciliationIssues: periods.filter((p) => p.status === "reconciliation_failed").length,
    reconciliationPassed: period?.status === "completed",
  };
}

export async function getPlansWithSummaries() {
  const plans = await getPlanningPeriods();
  if (!plans.length) return [];

  const supabase = await createClient();
  const planIds = plans.map((p) => p.id);

  const { data: targets } = await supabase
    .from("targets")
    .select("planning_period_id, target_units")
    .in("planning_period_id", planIds);

  return plans.map((plan) => {
    const planTargets = (targets || []).filter((t) => t.planning_period_id === plan.id);
    return {
      ...plan,
      targetCount: planTargets.length,
      totalUnits: planTargets.reduce((sum, t) => sum + t.target_units, 0),
    };
  });
}

export async function getDemandSupplyDashboardKPIs(userId) {
  const periods = await getPlanningPeriods();
  const activePlan = periods[0] || null;
  const stats = activePlan ? await getDashboardStats(activePlan.id, userId) : null;

  const planReadyToFinalize = periods.find((p) => p.status === "md_approved") || null;

  return {
    activePlan,
    planReadyToFinalize,
    planStatusLabel: activePlan ? STATUS_LABELS[activePlan.status] : "No active plan",
    totalTargetUnits: stats?.totalUnits ?? 0,
    draftPlans: periods.filter((p) => p.status === "draft").length,
    submittedPlans: periods.filter((p) => SUBMITTED_STATUSES.includes(p.status)).length,
    returnedPlans: periods.filter((p) => RETURNED_STATUSES.includes(p.status)).length,
    completedPlans: periods.filter((p) => COMPLETED_STATUSES.includes(p.status)).length,
    notifications: stats?.notificationCount ?? 0,
  };
}

export async function getITAdminDashboardData() {
  const supabase = await createClient();

  const [{ data: users }, { count: auditEvents }] = await Promise.all([
    supabase.from("users").select("id"),
    supabase.from("audit_logs").select("*", { count: "exact", head: true }),
  ]);

  return {
    activeUsers: users?.length ?? 0,
    auditEvents: auditEvents ?? 0,
    systemHealth: "Healthy",
  };
}
