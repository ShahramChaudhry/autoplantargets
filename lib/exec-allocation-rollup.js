/**
 * Pure roll-ups for Branch Manager Sales Executive allocation.
 * UI is exec × sales group; persistence expands to exec × model leaves.
 */

export function parseUnits(raw) {
  if (raw === "" || raw === undefined || raw === null) return 0;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function cellKey(execCode, model) {
  return `${execCode}::${model}`;
}

export function groupCellKey(salesGroupName, execCode) {
  return `${salesGroupName}::${execCode}`;
}

/**
 * Office model targets from NPM leaf rows for one office + sales group.
 * Article leaves win when present for a model; otherwise model×office leaves.
 */
export function buildOfficeModelTargets(targets, salesGroup, officeName) {
  const rows = (targets || []).filter(
    (t) =>
      t.sales_group === salesGroup &&
      t.sales_office === officeName &&
      t.model
  );

  const byModel = new Map();
  for (const row of rows) {
    const key = `${row.brand || ""}::${row.model}`;
    if (!byModel.has(key)) {
      byModel.set(key, {
        brand: row.brand || null,
        model: row.model,
        articleSum: 0,
        modelSum: 0,
      });
    }
    const entry = byModel.get(key);
    const units = Number(row.target_units) || 0;
    if (row.article_code) entry.articleSum += units;
    else entry.modelSum += units;
  }

  return [...byModel.values()]
    .map((e) => ({
      brand: e.brand,
      model: e.model,
      officeTarget: e.articleSum > 0 ? e.articleSum : e.modelSum,
    }))
    .filter((e) => e.officeTarget > 0)
    .sort((a, b) => a.model.localeCompare(b.model));
}

/** Office total for one sales group (sum of NPM model leaves). */
export function officeGroupTarget(targets, salesGroup, officeName) {
  return buildOfficeModelTargets(targets, salesGroup, officeName).reduce(
    (sum, m) => sum + m.officeTarget,
    0
  );
}

/** Sum saved exec leaves for one exec × sales group × office. */
export function sumExecGroupUnits(existingAllocations, salesGroup, officeName, execCode) {
  return (existingAllocations || [])
    .filter(
      (r) =>
        r.sales_group === salesGroup &&
        r.sales_office === officeName &&
        String(r.sales_exec_code) === String(execCode)
    )
    .reduce((sum, r) => sum + (Number(r.target_units) || 0), 0);
}

export function modelColumnAllocated(values, execCodes, model) {
  return execCodes.reduce(
    (sum, code) => sum + parseUnits(values[cellKey(code, model)]),
    0
  );
}

export function execRowTotal(values, models, execCode) {
  return models.reduce(
    (sum, m) => sum + parseUnits(values[cellKey(execCode, m.model)]),
    0
  );
}

export function computeExecAllocationStatus({ values, models, executives }) {
  const execCodes = executives.map((e) => e.id || e.code || e.sales_exec_code);
  const modelStatuses = models.map((m) => {
    const allocated = modelColumnAllocated(values, execCodes, m.model);
    const target = m.officeTarget;
    return {
      brand: m.brand,
      model: m.model,
      allocated,
      target,
      remaining: target - allocated,
      over: allocated > target,
      complete: allocated === target,
    };
  });

  const allocatedTotal = modelStatuses.reduce((s, m) => s + m.allocated, 0);
  const officeTotal = modelStatuses.reduce((s, m) => s + m.target, 0);
  const hasOver = modelStatuses.some((m) => m.over);
  const isFullyAllocated =
    officeTotal > 0 &&
    !hasOver &&
    modelStatuses.every((m) => m.complete) &&
    allocatedTotal === officeTotal;

  return {
    modelStatuses,
    allocatedTotal,
    officeTotal,
    remainingTotal: officeTotal - allocatedTotal,
    hasOver,
    isFullyAllocated,
    remainingModels: modelStatuses.filter((m) => m.remaining > 0 && !m.over),
  };
}

/** Status for exec × sales-group UI. */
export function computeExecGroupAllocationStatus({
  values,
  salesGroups,
  executives,
  officeTargetsByGroup,
}) {
  const execCodes = executives.map((e) => e.id || e.code || e.sales_exec_code);
  const groupStatuses = salesGroups.map((g) => {
    const name = g.name || g;
    const allocated = execCodes.reduce(
      (sum, code) => sum + parseUnits(values[groupCellKey(name, code)]),
      0
    );
    const target = officeTargetsByGroup[name] || 0;
    return {
      salesGroup: name,
      allocated,
      target,
      remaining: target - allocated,
      over: target > 0 && allocated > target,
      complete: target > 0 && allocated === target,
      inactive: target <= 0,
    };
  });

  const active = groupStatuses.filter((g) => !g.inactive);
  const allocatedTotal = active.reduce((s, g) => s + g.allocated, 0);
  const officeTotal = active.reduce((s, g) => s + g.target, 0);
  const hasOver = active.some((g) => g.over);
  const isFullyAllocated =
    officeTotal > 0 &&
    !hasOver &&
    active.every((g) => g.complete) &&
    allocatedTotal === officeTotal;

  return {
    groupStatuses,
    allocatedTotal,
    officeTotal,
    remainingTotal: officeTotal - allocatedTotal,
    hasOver,
    isFullyAllocated,
    remainingGroups: active.filter((g) => g.remaining > 0 && !g.over),
  };
}

export function buildExecSavePayload({
  values,
  models,
  executives,
  salesGroup,
  salesOffice,
}) {
  const rows = [];
  for (const exec of executives) {
    const code = exec.id || exec.code || exec.sales_exec_code;
    const name = exec.name || exec.sales_exec_name || "";
    for (const m of models) {
      const units = parseUnits(values[cellKey(code, m.model)]);
      rows.push({
        sales_group: salesGroup,
        sales_office: salesOffice,
        sales_exec_code: code,
        sales_exec_name: name,
        brand: m.brand,
        model: m.model,
        article_code: null,
        target_units: units,
      });
    }
  }
  return rows;
}

function allocateByWeights(total, weightedModels) {
  const weightSum = weightedModels.reduce((s, m) => s + m.weight, 0);
  if (total <= 0 || weightSum <= 0 || weightedModels.length === 0) {
    return weightedModels.map((m) => ({ model: m.model, brand: m.brand, units: 0 }));
  }

  const parts = weightedModels.map((m) => {
    const exact = (total * m.weight) / weightSum;
    return {
      model: m.model,
      brand: m.brand,
      units: Math.floor(exact),
      frac: exact - Math.floor(exact),
    };
  });
  let remainder = total - parts.reduce((s, p) => s + p.units, 0);
  const ranked = [...parts].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < ranked.length && remainder > 0; i++) {
    ranked[i].units += 1;
    remainder -= 1;
  }
  return parts.map((p) => ({ model: p.model, brand: p.brand, units: p.units }));
}

/**
 * Expand exec × sales-group totals into exec × model leaves for save-exec-grid.
 */
export function expandExecGroupAllocationsToModelLeaves({
  values,
  executives,
  salesGroupName,
  salesOffice,
  targets,
  existingAllocations = [],
}) {
  const models = buildOfficeModelTargets(targets, salesGroupName, salesOffice);
  if (models.length === 0) return [];

  const rows = [];
  for (const exec of executives) {
    const code = exec.id || exec.code || exec.sales_exec_code;
    const name = exec.name || exec.sales_exec_name || "";
    const officeTotal = parseUnits(values[groupCellKey(salesGroupName, code)]);

    const existingByModel = {};
    for (const row of existingAllocations) {
      if (
        row.sales_group !== salesGroupName ||
        row.sales_office !== salesOffice ||
        String(row.sales_exec_code) !== String(code) ||
        !row.model
      ) {
        continue;
      }
      existingByModel[row.model] =
        (existingByModel[row.model] || 0) + (Number(row.target_units) || 0);
    }
    const existingTotal = Object.values(existingByModel).reduce((s, v) => s + v, 0);

    const weighted =
      existingTotal > 0
        ? models.map((m) => ({
            model: m.model,
            brand: m.brand,
            weight: existingByModel[m.model] || 0,
          }))
        : models.map((m) => ({
            model: m.model,
            brand: m.brand,
            weight: m.officeTarget,
          }));

    const weightSum = weighted.reduce((s, w) => s + w.weight, 0);
    const finalWeights =
      weightSum > 0
        ? weighted
        : models.map((m) => ({
            model: m.model,
            brand: m.brand,
            weight: m.officeTarget,
          }));

    const split = allocateByWeights(officeTotal, finalWeights);
    for (const part of split) {
      rows.push({
        sales_group: salesGroupName,
        sales_office: salesOffice,
        sales_exec_code: code,
        sales_exec_name: name,
        brand: part.brand,
        model: part.model,
        article_code: null,
        target_units: part.units,
      });
    }
  }
  return rows;
}

/** True when BM may view/edit this office. */
export function isOfficeInScope(allowedOfficeNames, officeName) {
  if (!allowedOfficeNames || allowedOfficeNames === "all") return true;
  if (!Array.isArray(allowedOfficeNames)) return false;
  return allowedOfficeNames.includes(officeName);
}
