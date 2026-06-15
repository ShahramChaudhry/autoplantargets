import { createClient } from "@/lib/supabase/server";
import { findPlanBySlug, planSlug } from "@/lib/plans";
import { STATUS_LABELS, ROLES } from "@/lib/constants";
import {
  repairLegacyPlanStatuses,
  isAwaitingMDApproval,
  isAwaitingB2BReview,
} from "@/lib/workflow";

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
  if (!plan) return role === ROLES.MANAGING_DIRECTOR ? "/approval-queue" : "/review-queue";
  const slug = planSlug(plan.month, plan.year);
  return role === ROLES.MANAGING_DIRECTOR
    ? `/approval-queue?plan=${slug}`
    : `/review-queue?plan=${slug}`;
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
    .select("target_units")
    .eq("planning_period_id", periodId);

  const totalUnits = (targets || []).reduce((s, t) => s + t.target_units, 0);

  return {
    targetCount: targetCount || 0,
    modelCount: modelCount || 0,
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

  return {
    stats,
    retailTotal,
    officeTotal,
    execTotal,
    pendingReview: periods.some((p) => isAwaitingB2BReview(p.status)),
    pendingApproval: periods.some((p) => isAwaitingMDApproval(p.status)),
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

  const pendingB2B = periods.filter((p) => isAwaitingB2BReview(p.status)).length;

  const pendingMD = periods.filter((p) => isAwaitingMDApproval(p.status)).length;

  const planReadyToFinalize = periods.find((p) => p.status === "md_approved") || null;

  return {
    activePlan,
    planReadyToFinalize,
    planStatusLabel: activePlan ? STATUS_LABELS[activePlan.status] : "No active plan",
    totalTargetUnits: stats?.totalUnits ?? 0,
    pendingB2B,
    pendingMD,
    notifications: stats?.notificationCount ?? 0,
  };
}
