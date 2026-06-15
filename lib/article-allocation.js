import { isValidModelArticle } from "@/lib/master-data";

export async function getModelAllocationContext(supabase, modelAllocationId) {
  const { data: modelAlloc } = await supabase
    .from("model_allocations")
    .select("id, model, units, target_id, targets(brand)")
    .eq("id", modelAllocationId)
    .single();

  if (!modelAlloc) {
    return { error: "Model allocation not found" };
  }

  const brand = modelAlloc.targets?.brand;
  if (!brand) {
    return { error: "Target not found for model allocation" };
  }

  return { modelAlloc, brand };
}

export async function validateArticleAllocation(
  supabase,
  { modelAllocationId, articleCode, units, excludeId }
) {
  const context = await getModelAllocationContext(supabase, modelAllocationId);
  if (context.error) {
    return { error: context.error };
  }

  const { modelAlloc, brand } = context;

  if (!isValidModelArticle(brand, modelAlloc.model, articleCode)) {
    return {
      error: `"${articleCode}" is not a valid article code for ${brand} ${modelAlloc.model}.`,
    };
  }

  let query = supabase
    .from("article_allocations")
    .select("id, units, article_code")
    .eq("model_allocation_id", modelAllocationId);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data: existing } = await query;

  const duplicate = (existing || []).find((row) => row.article_code === articleCode);
  if (duplicate) {
    return { error: `${articleCode} is already allocated for ${modelAlloc.model}.` };
  }

  const allocated = (existing || []).reduce((sum, row) => sum + row.units, 0);
  const remaining = modelAlloc.units - allocated;

  if (units > remaining) {
    return {
      error: `Cannot allocate ${units} units. Only ${remaining} units remaining for ${modelAlloc.model}.`,
    };
  }

  if (units <= 0) {
    return { error: "Units must be greater than zero." };
  }

  return { modelAlloc, brand, remaining };
}

export async function validateArticleUnitsUpdate(supabase, { articleId, units }) {
  const { data: article } = await supabase
    .from("article_allocations")
    .select("id, model_allocation_id, article_code, units")
    .eq("id", articleId)
    .single();

  if (!article) {
    return { error: "Article allocation not found" };
  }

  if (units <= 0) {
    return { error: "Units must be greater than zero." };
  }

  const { data: siblings } = await supabase
    .from("article_allocations")
    .select("id, units")
    .eq("model_allocation_id", article.model_allocation_id)
    .neq("id", articleId);

  const { data: modelAlloc } = await supabase
    .from("model_allocations")
    .select("model, units")
    .eq("id", article.model_allocation_id)
    .single();

  if (!modelAlloc) {
    return { error: "Model allocation not found" };
  }

  const otherAllocated = (siblings || []).reduce((sum, row) => sum + row.units, 0);
  const remaining = modelAlloc.units - otherAllocated;

  if (units > remaining) {
    return {
      error: `Cannot set ${units} units. Only ${remaining} units remaining for ${modelAlloc.model}.`,
    };
  }

  return { article, modelAlloc };
}
