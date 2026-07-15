import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { assertPlanEditable } from "@/lib/plan-editability";

/**
 * Sync model_allocations + article_allocations from model-level targets.
 * The planning grid writes targets directly; this keeps downstream workflow counts in sync.
 */
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.DEMAND_SUPPLY) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { periodId, articles = [] } = await request.json();
  if (!periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const editCheck = await assertPlanEditable(supabase, { type: "targets", periodId });
  if (editCheck.error) {
    return NextResponse.json({ error: editCheck.error }, { status: 400 });
  }

  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", periodId);

  const modelTargets = (targets || []).filter((t) => t.model && t.target_units > 0);

  for (const target of modelTargets) {
    const { data: existingModels } = await supabase
      .from("model_allocations")
      .select("id")
      .eq("target_id", target.id);

    if ((existingModels || []).length === 0) {
      await supabase.from("model_allocations").insert({
        target_id: target.id,
        model: target.model,
        units: target.target_units,
      });
    } else {
      await supabase
        .from("model_allocations")
        .update({ model: target.model, units: target.target_units })
        .eq("target_id", target.id);
    }
  }

  for (const row of articles) {
    if (!row.targetId || !row.articleCode || !row.units) continue;

    const { data: modelAlloc } = await supabase
      .from("model_allocations")
      .select("id")
      .eq("target_id", row.targetId)
      .maybeSingle();

    if (!modelAlloc?.id) continue;

    const { data: existingArticle } = await supabase
      .from("article_allocations")
      .select("id")
      .eq("model_allocation_id", modelAlloc.id)
      .eq("article_code", row.articleCode)
      .maybeSingle();

    if (existingArticle?.id) {
      await supabase
        .from("article_allocations")
        .update({ units: row.units })
        .eq("id", existingArticle.id);
    } else if (row.units > 0) {
      await supabase.from("article_allocations").insert({
        model_allocation_id: modelAlloc.id,
        article_code: row.articleCode,
        units: row.units,
      });
    }
  }

  return NextResponse.json({ success: true });
}
