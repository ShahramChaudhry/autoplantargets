import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES, getArticleCodesForModel } from "@/lib/constants";
import { isRetailAllocationEditable } from "@/lib/retail-allocation";
import { deriveModelTotalsFromArticleLeaves } from "@/lib/npm-allocation-rollup";
import { logAudit } from "@/lib/workflow";

function isBlankOffice(value) {
  return value == null || value === "";
}

function isBlankArticle(value) {
  return value == null || value === "";
}

/** D&S model totals: sales_office null, article_code null. */
function buildDsModelTotals(rows, salesGroup) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.sales_group !== salesGroup) continue;
    if (!isBlankOffice(row.sales_office)) continue;
    if (!isBlankArticle(row.article_code)) continue;
    if (!row.model) continue;
    const key = `${row.brand}::${row.model}`;
    map.set(key, (map.get(key) || 0) + (Number(row.target_units) || 0));
  }
  return map;
}

async function findLeafRow(supabase, periodId, row) {
  let query = supabase
    .from("targets")
    .select("id")
    .eq("planning_period_id", periodId)
    .eq("brand", row.brand)
    .eq("sales_group", row.sales_group)
    .eq("model", row.model)
    .eq("sales_office", row.sales_office);

  if (isBlankArticle(row.article_code)) {
    query = query.is("article_code", null);
  } else {
    query = query.eq("article_code", row.article_code);
  }

  const { data } = await query.maybeSingle();
  return data;
}

async function upsertLeaf(supabase, periodId, row, savedIds) {
  const units = Number(row.target_units) || 0;
  const existing = await findLeafRow(supabase, periodId, row);

  if (existing?.id) {
    if (units <= 0) {
      await supabase.from("targets").delete().eq("id", existing.id);
      return;
    }
    const { error } = await supabase
      .from("targets")
      .update({ target_units: units })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    savedIds.push(existing.id);
  } else if (units > 0) {
    const payload = {
      planning_period_id: periodId,
      brand: row.brand,
      sales_group: row.sales_group,
      model: row.model,
      sales_office: row.sales_office,
      target_units: units,
      article_code: isBlankArticle(row.article_code) ? null : row.article_code,
    };
    const { data: inserted, error } = await supabase
      .from("targets")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    savedIds.push(inserted.id);
  }
}

/**
 * Delete stale model-office rows (article_code null) when a model now uses article leaves.
 */
/**
 * Delete stale model-office rows when a model is saved in article mode.
 */
async function deleteStaleModelOfficeRows(supabase, periodId, salesGroup, articleLeaves) {
  const modelsInPayload = new Set(articleLeaves.map((r) => `${r.brand}::${r.model}`));
  if (modelsInPayload.size === 0) return;

  const { data: rows } = await supabase
    .from("targets")
    .select("id, brand, model, sales_office, article_code")
    .eq("planning_period_id", periodId)
    .eq("sales_group", salesGroup);

  for (const row of rows || []) {
    if (!row.sales_office) continue;
    if (!isBlankArticle(row.article_code)) continue;
    if (modelsInPayload.has(`${row.brand}::${row.model}`)) {
      await supabase.from("targets").delete().eq("id", row.id);
    }
  }
}

/**
 * Delete article leaves when a model is saved in model mode.
 */
async function deleteArticleLeavesForModels(supabase, periodId, salesGroup, modelLeaves) {
  const modelsInPayload = new Set(modelLeaves.map((r) => `${r.brand}::${r.model}`));
  if (modelsInPayload.size === 0) return;

  const { data: rows } = await supabase
    .from("targets")
    .select("id, brand, model, sales_office, article_code")
    .eq("planning_period_id", periodId)
    .eq("sales_group", salesGroup);

  for (const row of rows || []) {
    if (isBlankArticle(row.article_code)) continue;
    if (modelsInPayload.has(`${row.brand}::${row.model}`)) {
      await supabase.from("targets").delete().eq("id", row.id);
    }
  }
}

/**
 * Remove article leaves that are no longer in the payload for models we're saving with articles.
 */
async function pruneMissingArticleLeaves(supabase, periodId, salesGroup, articleLeaves) {
  const keep = new Set(
    articleLeaves
      .filter((r) => (Number(r.target_units) || 0) > 0)
      .map(
        (r) =>
          `${r.brand}::${r.model}::${r.sales_office}::${r.article_code}`
      )
  );
  const brandsModels = new Set(articleLeaves.map((r) => `${r.brand}::${r.model}`));
  if (brandsModels.size === 0) return;

  const { data: rows } = await supabase
    .from("targets")
    .select("id, brand, model, sales_office, article_code")
    .eq("planning_period_id", periodId)
    .eq("sales_group", salesGroup);

  for (const row of rows || []) {
    if (isBlankArticle(row.article_code)) continue;
    const bm = `${row.brand}::${row.model}`;
    if (!brandsModels.has(bm)) continue;
    const key = `${row.brand}::${row.model}::${row.sales_office}::${row.article_code}`;
    if (!keep.has(key)) {
      await supabase.from("targets").delete().eq("id", row.id);
    }
  }
}

function validateAgainstDs(dsTotals, articles, models) {
  const allocatedByModel = new Map();
  const articleModels = new Set();
  const modelModels = new Set();

  for (const row of articles) {
    const key = `${row.brand}::${row.model}`;
    const units = Number(row.target_units) || 0;
    const codes = getArticleCodesForModel(row.brand, row.model);
    if (!codes.includes(row.article_code)) {
      return {
        error: `Invalid article ${row.article_code} for ${row.brand} ${row.model}.`,
      };
    }
    if (units > 0) articleModels.add(key);
    allocatedByModel.set(key, (allocatedByModel.get(key) || 0) + units);
  }

  for (const row of models) {
    const key = `${row.brand}::${row.model}`;
    const units = Number(row.target_units) || 0;
    if (units > 0) modelModels.add(key);
    allocatedByModel.set(key, (allocatedByModel.get(key) || 0) + units);
  }

  for (const key of articleModels) {
    if (modelModels.has(key)) {
      const [brand, model] = key.split("::");
      return {
        error: `${brand} ${model}: cannot save both model-level and article-level allocations.`,
      };
    }
  }

  for (const [key, allocated] of allocatedByModel) {
    const ds = dsTotals.get(key) || 0;
    if (allocated > ds) {
      const [brand, model] = key.split("::");
      return {
        error: `${brand} ${model}: allocated ${allocated} exceeds D&S total ${ds}.`,
      };
    }
  }

  const brandAllocated = new Map();
  const brandDs = new Map();
  for (const [key, ds] of dsTotals) {
    const brand = key.split("::")[0];
    brandDs.set(brand, (brandDs.get(brand) || 0) + ds);
  }
  for (const [key, allocated] of allocatedByModel) {
    const brand = key.split("::")[0];
    brandAllocated.set(brand, (brandAllocated.get(brand) || 0) + allocated);
  }
  for (const [brand, allocated] of brandAllocated) {
    const ds = brandDs.get(brand) || 0;
    if (allocated > ds) {
      return {
        error: `${brand} brand: allocated ${allocated} exceeds D&S total ${ds}.`,
      };
    }
  }

  return { ok: true, allocatedByModel };
}

/**
 * NPM saves exclusive leaf office allocations:
 * - article mode → article×office rows (article_code set); model×office cleared
 * - model mode → model×office rows (article_code null); article×office cleared
 * Brand values are never persisted as user input.
 */
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.NPM) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const body = await request.json();
  const { periodId, salesGroup } = body;
  // Prefer explicit leaf payloads; fall back to legacy `targets` as model-level leaves.
  let articles = Array.isArray(body.articles) ? body.articles : [];
  let models = Array.isArray(body.models) ? body.models : [];
  if (!articles.length && !models.length && Array.isArray(body.targets)) {
    models = body.targets.map((t) => ({ ...t, article_code: null }));
  }

  if (!periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
  }

  const sg = salesGroup || "Retail";
  const supabase = await createClient();
  const { data: period } = await supabase
    .from("planning_periods")
    .select("id, status")
    .eq("id", periodId)
    .single();

  if (!period) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (!isRetailAllocationEditable(period.status)) {
    return NextResponse.json(
      {
        error:
          "Sales office allocation is only available after the plan is finalized.",
      },
      { status: 400 }
    );
  }

  try {
    const { data: allTargets } = await supabase
      .from("targets")
      .select("brand, sales_group, model, sales_office, article_code, target_units")
      .eq("planning_period_id", periodId)
      .eq("sales_group", sg);

    const dsTotals = buildDsModelTotals(allTargets, sg);
    const validation = validateAgainstDs(dsTotals, articles, models);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Normalize leaves
    articles = articles
      .filter((r) => r.brand && r.model && r.sales_office && r.article_code)
      .map((r) => ({
        brand: r.brand,
        sales_group: r.sales_group || sg,
        model: r.model,
        article_code: r.article_code,
        sales_office: r.sales_office,
        target_units: Number(r.target_units) || 0,
      }));

    models = models
      .filter((r) => r.brand && r.model && r.sales_office && isBlankArticle(r.article_code))
      .map((r) => ({
        brand: r.brand,
        sales_group: r.sales_group || sg,
        model: r.model,
        article_code: null,
        sales_office: r.sales_office,
        target_units: Number(r.target_units) || 0,
      }));

    const savedIds = [];

    await deleteStaleModelOfficeRows(supabase, periodId, sg, articles);
    await deleteArticleLeavesForModels(supabase, periodId, sg, models);
    await pruneMissingArticleLeaves(supabase, periodId, sg, articles);

    for (const row of articles) {
      await upsertLeaf(supabase, periodId, row, savedIds);
    }
    for (const row of models) {
      await upsertLeaf(supabase, periodId, row, savedIds);
    }

    // Derived model totals (for logging / consumers) — not written as editable source rows
    // when articles exist (stale model-office rows already deleted above).
    const derivedModels = deriveModelTotalsFromArticleLeaves(articles);

    // Rebuild office aggregates from all leaf rows (article + model-without-articles)
    const { data: officeScoped } = await supabase
      .from("targets")
      .select("sales_office, target_units, article_code, model")
      .eq("planning_period_id", periodId)
      .eq("sales_group", sg);

    const aggregated = {};
    for (const row of officeScoped || []) {
      if (!row.sales_office) continue;
      aggregated[row.sales_office] =
        (aggregated[row.sales_office] || 0) + (row.target_units || 0);
    }

    if (sg === "Retail") {
      const { data: existingOffices } = await supabase
        .from("sales_office_allocations")
        .select("id, sales_office")
        .eq("planning_period_id", periodId);

      const byName = Object.fromEntries(
        (existingOffices || []).map((o) => [o.sales_office, o.id])
      );

      for (const [officeName, units] of Object.entries(aggregated)) {
        const existingId = byName[officeName];
        if (existingId) {
          await supabase
            .from("sales_office_allocations")
            .update({ units })
            .eq("id", existingId);
        } else if (units > 0) {
          await supabase.from("sales_office_allocations").insert({
            planning_period_id: periodId,
            sales_office: officeName,
            units,
          });
        }
      }

      for (const row of existingOffices || []) {
        if (!aggregated[row.sales_office] || aggregated[row.sales_office] <= 0) {
          await supabase.from("sales_office_allocations").delete().eq("id", row.id);
        }
      }
    }

    await logAudit(supabase, {
      userId: user.id,
      action: "updated",
      entityType: "sales_office_allocations",
      entityId: periodId,
      details: {
        sales_group: sg,
        saved: savedIds.length,
        article_leaves: articles.length,
        model_leaves: models.length,
        derived_model_totals: derivedModels,
        offices: Object.keys(aggregated).length,
      },
      planningPeriodId: periodId,
    });

    return NextResponse.json({
      success: true,
      savedCount: savedIds.length,
      officeTotals: aggregated,
      derivedModelTotals: derivedModels,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to save" }, { status: 500 });
  }
}
