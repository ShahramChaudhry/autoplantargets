import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { assertPlanEditable } from "@/lib/plan-editability";
import { logAudit } from "@/lib/workflow";

/**
 * Atomically save all planning-grid targets (+ optional articles) for a plan.
 * One request → durable Supabase (or local DB) write — avoids Vercel /tmp races.
 */
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.DEMAND_SUPPLY) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const body = await request.json();
  const { periodId, targets = [], articles = [] } = body;

  if (!periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const editCheck = await assertPlanEditable(supabase, { type: "targets", periodId });
  if (editCheck.error) {
    return NextResponse.json({ error: editCheck.error }, { status: 400 });
  }

  try {
    const savedIds = [];
    const idByKey = {};

    for (const row of targets) {
      const units = Number(row.target_units) || 0;
      if (!row.brand || !row.sales_group || !row.model) continue;

      let query = supabase
        .from("targets")
        .select("id")
        .eq("planning_period_id", periodId)
        .eq("brand", row.brand)
        .eq("sales_group", row.sales_group)
        .eq("model", row.model)
        .is("article_code", null);

      if (row.sales_office) {
        query = query.eq("sales_office", row.sales_office);
      } else {
        query = query.is("sales_office", null);
      }

      const { data: existing, error: findError } = await query.maybeSingle();
      if (findError) throw new Error(findError.message);

      const cellKey = `${row.brand}::${row.sales_group}::${row.model}::${row.sales_office || ""}`;

      if (existing?.id) {
        if (units <= 0) {
          await supabase.from("targets").delete().eq("id", existing.id);
          continue;
        }
        const { error } = await supabase
          .from("targets")
          .update({ target_units: units, article_code: null })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        savedIds.push(existing.id);
        idByKey[cellKey] = existing.id;
      } else if (units > 0) {
        const { data: inserted, error } = await supabase
          .from("targets")
          .insert({
            planning_period_id: periodId,
            brand: row.brand,
            sales_group: row.sales_group,
            model: row.model,
            sales_office: row.sales_office || null,
            article_code: null,
            target_units: units,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        savedIds.push(inserted.id);
        idByKey[cellKey] = inserted.id;
      }
    }

    // Sync model allocations from D&S model-level targets only (ignore NPM office/article leaves)
    const { data: periodTargets, error: loadError } = await supabase
      .from("targets")
      .select("*")
      .eq("planning_period_id", periodId);
    if (loadError) throw new Error(loadError.message);

    const modelTargets = (periodTargets || []).filter(
      (t) => t.model && t.target_units > 0 && !t.sales_office && !t.article_code
    );

    for (const target of modelTargets) {
      const { data: existingModels } = await supabase
        .from("model_allocations")
        .select("id")
        .eq("target_id", target.id);

      if ((existingModels || []).length === 0) {
        const { error } = await supabase.from("model_allocations").insert({
          target_id: target.id,
          model: target.model,
          units: target.target_units,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("model_allocations")
          .update({ model: target.model, units: target.target_units })
          .eq("target_id", target.id);
        if (error) throw new Error(error.message);
      }
    }

    for (const row of articles) {
      const units = Number(row.units) || 0;
      let targetId = row.targetId;

      if (!targetId && row.brand && row.model) {
        const cellKey = `${row.brand}::${row.sales_group}::${row.model}::${row.sales_office || ""}`;
        targetId = idByKey[cellKey];
      }

      if (!targetId || !row.articleCode) continue;

      const { data: modelAlloc } = await supabase
        .from("model_allocations")
        .select("id")
        .eq("target_id", targetId)
        .maybeSingle();

      if (!modelAlloc?.id) continue;

      const { data: existingArticle } = await supabase
        .from("article_allocations")
        .select("id")
        .eq("model_allocation_id", modelAlloc.id)
        .eq("article_code", row.articleCode)
        .maybeSingle();

      if (existingArticle?.id) {
        if (units <= 0) {
          await supabase.from("article_allocations").delete().eq("id", existingArticle.id);
        } else {
          const { error } = await supabase
            .from("article_allocations")
            .update({ units })
            .eq("id", existingArticle.id);
          if (error) throw new Error(error.message);
        }
      } else if (units > 0) {
        const { error } = await supabase.from("article_allocations").insert({
          model_allocation_id: modelAlloc.id,
          article_code: row.articleCode,
          units,
        });
        if (error) throw new Error(error.message);
      }
    }

    await logAudit(supabase, {
      userId: user.id,
      action: "updated",
      entityType: "targets",
      entityId: periodId,
      details: {
        saved: savedIds.length,
        sales_group: targets[0]?.sales_group || null,
      },
      planningPeriodId: periodId,
    });

    return NextResponse.json({
      success: true,
      targetCount: modelTargets.length,
      savedIds,
      idByKey,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to save grid" }, { status: 500 });
  }
}
