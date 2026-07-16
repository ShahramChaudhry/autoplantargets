/**
 * Reconciliation between the three planning layers:
 *
 *   D&S  → (sales_group, brand, model) header totals
 *   NPM  → (sales_group, brand, model, sales_office) leaves
 *   BM   → (sales_group, brand, model, sales_office, exec) leaves
 *
 * Identities that must always hold:
 *
 *   1. For each (sales_group, brand, model):
 *        D&S_total == Σ_office NPM_leaf
 *
 *   2. For each (sales_group, brand, model, sales_office):
 *        NPM_leaf == Σ_exec sales_exec_targets
 *
 * Equivalently, for each sales_group:
 *   Σ D&S == Σ NPM leaves == Σ exec leaves
 */

function num(v) {
  return Number(v) || 0;
}

function isDsHeader(row) {
  return Boolean(row.model && !row.sales_office && !row.article_code);
}

function isNpmLeaf(row) {
  return Boolean(row.model && row.sales_office);
}

/** Collapse article×office into model×office; prefer article sum when present. */
export function buildNpmOfficeModelMap(targets) {
  const map = new Map();
  for (const row of targets || []) {
    if (!isNpmLeaf(row)) continue;
    const key = `${row.sales_group}::${row.brand || ""}::${row.model}::${row.sales_office}`;
    if (!map.has(key)) {
      map.set(key, {
        sales_group: row.sales_group,
        brand: row.brand || null,
        model: row.model,
        sales_office: row.sales_office,
        articleSum: 0,
        modelSum: 0,
      });
    }
    const entry = map.get(key);
    const units = num(row.target_units);
    if (row.article_code) entry.articleSum += units;
    else entry.modelSum += units;
  }

  const result = new Map();
  for (const [key, e] of map) {
    result.set(key, {
      sales_group: e.sales_group,
      brand: e.brand,
      model: e.model,
      sales_office: e.sales_office,
      units: e.articleSum > 0 ? e.articleSum : e.modelSum,
    });
  }
  return result;
}

export function buildDsModelMap(targets) {
  const map = new Map();
  for (const row of targets || []) {
    if (!isDsHeader(row)) continue;
    const key = `${row.sales_group}::${row.brand || ""}::${row.model}`;
    map.set(key, (map.get(key) || 0) + num(row.target_units));
  }
  return map;
}

export function buildExecOfficeModelMap(execLeaves) {
  const map = new Map();
  for (const row of execLeaves || []) {
    if (!row.model || !row.sales_office || !row.sales_group) continue;
    const key = `${row.sales_group}::${row.brand || ""}::${row.model}::${row.sales_office}`;
    map.set(key, (map.get(key) || 0) + num(row.target_units));
  }
  return map;
}

/**
 * Pure reconciliation from in-memory rows.
 * @returns {{ passed, dsSum, npmSum, execSum, mismatches, groupRollups, incompleteOffices }}
 */
export function reconcileLayers({ targets = [], execLeaves = [] }) {
  const dsMap = buildDsModelMap(targets);
  const npmMap = buildNpmOfficeModelMap(targets);
  const execMap = buildExecOfficeModelMap(execLeaves);
  const mismatches = [];

  // D&S == Σ NPM offices (per model × sales group)
  const npmByModel = new Map();
  for (const leaf of npmMap.values()) {
    const key = `${leaf.sales_group}::${leaf.brand || ""}::${leaf.model}`;
    npmByModel.set(key, (npmByModel.get(key) || 0) + leaf.units);
  }

  for (const [key, dsUnits] of dsMap) {
    if (dsUnits <= 0) continue;
    const npmUnits = npmByModel.get(key) || 0;
    if (npmUnits !== dsUnits) {
      const [sales_group, brand, model] = key.split("::");
      mismatches.push({
        type: "ds_vs_npm",
        sales_group,
        brand: brand || null,
        model,
        ds: dsUnits,
        npm: npmUnits,
        diff: npmUnits - dsUnits,
      });
    }
  }

  for (const [key, npmUnits] of npmByModel) {
    if (npmUnits <= 0) continue;
    if (!dsMap.has(key)) {
      const [sales_group, brand, model] = key.split("::");
      mismatches.push({
        type: "npm_without_ds",
        sales_group,
        brand: brand || null,
        model,
        ds: 0,
        npm: npmUnits,
        diff: npmUnits,
      });
    }
  }

  // NPM office leaf == Σ exec (per model × office × sales group)
  const allOfficeKeys = new Set([...npmMap.keys(), ...execMap.keys()]);
  for (const key of allOfficeKeys) {
    const npmUnits = npmMap.get(key)?.units || 0;
    const execUnits = execMap.get(key) || 0;
    if (npmUnits === 0 && execUnits === 0) continue;
    if (npmUnits !== execUnits) {
      const [sales_group, brand, model, sales_office] = key.split("::");
      mismatches.push({
        type: "npm_vs_exec",
        sales_group,
        brand: brand || null,
        model,
        sales_office,
        npm: npmUnits,
        exec: execUnits,
        diff: execUnits - npmUnits,
      });
    }
  }

  const dsSum = [...dsMap.values()].reduce((s, v) => s + v, 0);
  const npmSum = [...npmMap.values()].reduce((s, v) => s + v.units, 0);
  const execSum = [...execMap.values()].reduce((s, v) => s + v, 0);

  // Per sales-group rollups for UI / notifications
  const groupRollups = {};
  for (const [key, units] of dsMap) {
    const sg = key.split("::")[0];
    if (!groupRollups[sg]) groupRollups[sg] = { ds: 0, npm: 0, exec: 0 };
    groupRollups[sg].ds += units;
  }
  for (const leaf of npmMap.values()) {
    if (!groupRollups[leaf.sales_group]) {
      groupRollups[leaf.sales_group] = { ds: 0, npm: 0, exec: 0 };
    }
    groupRollups[leaf.sales_group].npm += leaf.units;
  }
  for (const [key, units] of execMap) {
    const sg = key.split("::")[0];
    if (!groupRollups[sg]) groupRollups[sg] = { ds: 0, npm: 0, exec: 0 };
    groupRollups[sg].exec += units;
  }

  // Offices that still need exec allocation to match NPM
  const incompleteOffices = new Set();
  for (const [key, leaf] of npmMap) {
    if (leaf.units <= 0) continue;
    const execUnits = execMap.get(key) || 0;
    if (execUnits !== leaf.units) incompleteOffices.add(leaf.sales_office);
  }

  const passed = mismatches.length === 0 && dsSum === npmSum && npmSum === execSum;

  return {
    passed,
    dsSum,
    npmSum,
    execSum,
    // Aliases for older API consumers / notifications
    modelSum: dsSum,
    officeSum: npmSum,
    executiveSum: execSum,
    modelOfficeMatch: dsSum === npmSum,
    officeExecutiveMatch: npmSum === execSum,
    variance: dsSum - npmSum,
    executiveVariance: npmSum - execSum,
    mismatches: mismatches.slice(0, 50),
    mismatchCount: mismatches.length,
    groupRollups,
    incompleteOffices: [...incompleteOffices].sort(),
    allOfficesComplete: incompleteOffices.size === 0 && npmSum > 0,
  };
}

/**
 * Load period rows and reconcile.
 */
export async function calculateReconciliation(supabase, planningPeriodId) {
  const { data: targets, error: targetsError } = await supabase
    .from("targets")
    .select("brand, sales_group, model, sales_office, article_code, target_units")
    .eq("planning_period_id", planningPeriodId);

  if (targetsError) throw new Error(targetsError.message);

  const { data: execLeaves, error: execError } = await supabase
    .from("sales_exec_targets")
    .select("brand, sales_group, model, sales_office, target_units")
    .eq("planning_period_id", planningPeriodId);

  // Missing table → treat as empty exec layer (will fail until migrated)
  const leaves = execError ? [] : execLeaves || [];

  return reconcileLayers({ targets: targets || [], execLeaves: leaves });
}

/**
 * Apply reconciliation result to the plan: completed or reconciliation_failed + notify BMs.
 */
export async function applyReconciliationResult(supabase, {
  periodId,
  userId,
  result,
}) {
  const newStatus = result.passed ? "completed" : "reconciliation_failed";

  await supabase
    .from("planning_periods")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", periodId);

  const auditPayload = {
    user_id: userId || null,
    action: result.passed ? "reconciliation_passed" : "reconciliation_failed",
    entity_type: "planning_period",
    entity_id: periodId,
    details: {
      dsSum: result.dsSum,
      npmSum: result.npmSum,
      execSum: result.execSum,
      mismatchCount: result.mismatchCount,
      incompleteOffices: result.incompleteOffices,
      mismatches: result.mismatches?.slice(0, 10),
    },
    planning_period_id: periodId,
  };
  const { error: auditError } = await supabase.from("audit_logs").insert(auditPayload);
  if (auditError) {
    await supabase.from("audit_logs").insert({ ...auditPayload, user_id: null });
  }

  if (!result.passed) {
    const { data: branchManagers } = await supabase
      .from("users")
      .select("id")
      .eq("role", "branch_manager");

    const message = `Reconciliation failed: D&S (${result.dsSum}) vs Sales Office (${result.npmSum}) vs Executive (${result.execSum}). ${result.mismatchCount} mismatch(es). Please correct allocations.`;

    for (const bm of branchManagers || []) {
      await supabase.from("notifications").insert({
        user_id: bm.id,
        type: "reconciliation_failed",
        message,
        planning_period_id: periodId,
      });
    }
  }

  return newStatus;
}
