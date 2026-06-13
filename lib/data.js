import { createClient } from "@/lib/supabase/server";

export async function getPlanningPeriods() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_periods")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  return data || [];
}

export async function getActivePeriod(periodId) {
  const periods = await getPlanningPeriods();
  if (periodId) {
    return periods.find((p) => p.id === periodId) || periods[0];
  }
  return periods[0] || null;
}

export async function getDashboardStats(periodId) {
  const supabase = await createClient();

  const { data: periodTargets } = await supabase
    .from("targets")
    .select("id")
    .eq("planning_period_id", periodId);

  const targetIds = (periodTargets || []).map((t) => t.id);

  const [
    { count: targetCount },
    { count: modelCount },
    { count: officeCount },
    { count: notificationCount },
  ] = await Promise.all([
    supabase.from("targets").select("*", { count: "exact", head: true }).eq("planning_period_id", periodId),
    targetIds.length
      ? supabase.from("model_allocations").select("*", { count: "exact", head: true }).in("target_id", targetIds)
      : Promise.resolve({ count: 0 }),
    supabase.from("sales_office_allocations").select("*", { count: "exact", head: true }).eq("planning_period_id", periodId),
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("status", "unread"),
  ]);

  const { data: targets } = await supabase
    .from("targets")
    .select("target_units")
    .eq("planning_period_id", periodId);

  const totalUnits = (targets || []).reduce((s, t) => s + t.target_units, 0);

  return {
    targetCount: targetCount || 0,
    modelCount: modelCount || 0,
    officeCount: officeCount || 0,
    notificationCount: notificationCount || 0,
    totalUnits,
  };
}
