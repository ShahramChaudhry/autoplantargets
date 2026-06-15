import { isValidBrandModel } from "@/lib/master-data";

export async function validateModelAllocation(supabase, { targetId, model, units, excludeId }) {
  const { data: target } = await supabase
    .from("targets")
    .select("id, brand, target_units")
    .eq("id", targetId)
    .single();

  if (!target) {
    return { error: "Target not found" };
  }

  if (!isValidBrandModel(target.brand, model)) {
    return { error: `${model} is not a valid model for ${target.brand}` };
  }

  let query = supabase.from("model_allocations").select("id, units").eq("target_id", targetId);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data: existing } = await query;
  const allocated = (existing || []).reduce((sum, row) => sum + row.units, 0);
  const remaining = target.target_units - allocated;

  if (units > remaining) {
    return {
      error: `Cannot allocate ${units} units. Only ${remaining} units remaining for ${target.brand}.`,
    };
  }

  return { target };
}
