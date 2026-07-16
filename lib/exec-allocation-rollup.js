/**
 * Pure roll-ups for Branch Manager Sales Executive × Model allocation.
 * Source of truth: exec×model cells. Office model targets come from approved NPM leaves.
 */

export function parseUnits(raw) {
  if (raw === "" || raw === undefined || raw === null) return 0;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function cellKey(execCode, model) {
  return `${execCode}::${model}`;
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

/** True when BM may view/edit this office. */
export function isOfficeInScope(allowedOfficeNames, officeName) {
  if (!allowedOfficeNames || allowedOfficeNames === "all") return true;
  if (!Array.isArray(allowedOfficeNames)) return false;
  return allowedOfficeNames.includes(officeName);
}
