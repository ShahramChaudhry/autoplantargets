import { isPlanEditable } from "@/lib/workflow";

export const PLAN_LOCK_MESSAGE = "This plan is currently under review and cannot be edited.";

export async function resolvePlanningPeriod(supabase, { type, periodId, data, id }) {
  if (periodId) {
    const { data: period } = await supabase
      .from("planning_periods")
      .select("id, status, month, year")
      .eq("id", periodId)
      .single();
    return period;
  }

  if (type === "targets" && id) {
    const { data: target } = await supabase
      .from("targets")
      .select("planning_period_id")
      .eq("id", id)
      .single();
    if (target?.planning_period_id) {
      const { data: period } = await supabase
        .from("planning_periods")
        .select("id, status, month, year")
        .eq("id", target.planning_period_id)
        .single();
      return period;
    }
  }

  if (type === "models") {
    const targetId = data?.target_id;
    if (targetId) {
      const { data: target } = await supabase
        .from("targets")
        .select("planning_period_id")
        .eq("id", targetId)
        .single();
      if (target?.planning_period_id) {
        const { data: period } = await supabase
          .from("planning_periods")
          .select("id, status, month, year")
          .eq("id", target.planning_period_id)
          .single();
        return period;
      }
    }

    if (id) {
      const { data: model } = await supabase
        .from("model_allocations")
        .select("target_id, targets(planning_period_id)")
        .eq("id", id)
        .single();
      const planId = model?.targets?.planning_period_id;
      if (planId) {
        const { data: period } = await supabase
          .from("planning_periods")
          .select("id, status, month, year")
          .eq("id", planId)
          .single();
        return period;
      }
    }
  }

  if (type === "articles") {
    const modelAllocationId = data?.model_allocation_id;
    const lookupId = modelAllocationId || id;

    if (lookupId) {
      let modelId = modelAllocationId;

      if (!modelId && id) {
        const { data: article } = await supabase
          .from("article_allocations")
          .select("model_allocation_id")
          .eq("id", id)
          .single();
        modelId = article?.model_allocation_id;
      }

      if (modelId) {
        const { data: model } = await supabase
          .from("model_allocations")
          .select("target_id, targets(planning_period_id)")
          .eq("id", modelId)
          .single();
        const planId = model?.targets?.planning_period_id;
        if (planId) {
          const { data: period } = await supabase
            .from("planning_periods")
            .select("id, status, month, year")
            .eq("id", planId)
            .single();
          return period;
        }
      }
    }
  }

  return null;
}

export async function assertPlanEditable(supabase, params) {
  const period = await resolvePlanningPeriod(supabase, params);
  if (!period) {
    return { error: "Plan not found" };
  }
  if (!isPlanEditable(period.status)) {
    return { error: PLAN_LOCK_MESSAGE };
  }
  return { period };
}
