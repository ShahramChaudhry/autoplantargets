/**
 * Pure hierarchical roll-up for NPM Sales Office Allocation.
 * Source of truth: leaf allocations (articles when a model has articles, else model cells).
 *
 * article office values → model office values → brand office values
 */

export function parseUnits(raw) {
  if (raw === "" || raw === undefined || raw === null) return 0;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function modelHasArticles(articleCodes) {
  return Array.isArray(articleCodes) && articleCodes.length > 0;
}

/** Brand office cells are never user-editable. */
export function isBrandOfficeEditable() {
  return false;
}

/** Model office cells are editable only when the model has no article children. */
export function isModelOfficeEditable(articleCodes) {
  return !modelHasArticles(articleCodes);
}

/**
 * Sum article units for one model + office.
 */
export function rollupModelOfficeFromArticles({
  articleValues,
  model,
  officeName,
  articleCodes,
  rowKeyFn,
}) {
  if (!modelHasArticles(articleCodes)) return 0;
  return articleCodes.reduce((sum, code) => {
    const key = rowKeyFn(model, officeName, code);
    return sum + parseUnits(articleValues[key]);
  }, 0);
}

/**
 * Effective model×office units: from articles if model has them, else model leaf values.
 */
export function effectiveModelOfficeUnits({
  articleValues,
  modelValues,
  model,
  officeName,
  articleCodes,
  rowKeyFn,
}) {
  if (modelHasArticles(articleCodes)) {
    return rollupModelOfficeFromArticles({
      articleValues,
      model,
      officeName,
      articleCodes,
      rowKeyFn,
    });
  }
  return parseUnits(modelValues[rowKeyFn(model, officeName)]);
}

/**
 * Sum effective model×office across models for one brand+office.
 */
export function rollupBrandOfficeUnits({
  articleValues,
  modelValues,
  models,
  officeName,
  getArticleCodes,
  rowKeyFn,
}) {
  return models.reduce((sum, model) => {
    const codes = getArticleCodes(model);
    return (
      sum +
      effectiveModelOfficeUnits({
        articleValues,
        modelValues,
        model,
        officeName,
        articleCodes: codes,
        rowKeyFn,
      })
    );
  }, 0);
}

/**
 * Total allocated for one model across all offices (rolled up).
 */
export function modelAllocatedTotal({
  articleValues,
  modelValues,
  model,
  offices,
  articleCodes,
  rowKeyFn,
}) {
  return offices.reduce(
    (sum, office) =>
      sum +
      effectiveModelOfficeUnits({
        articleValues,
        modelValues,
        model,
        officeName: office.name,
        articleCodes,
        rowKeyFn,
      }),
    0
  );
}

/**
 * Total allocated for a brand across all offices (rolled up from models).
 */
export function brandAllocatedTotal({
  articleValues,
  modelValues,
  models,
  offices,
  getArticleCodes,
  rowKeyFn,
}) {
  return models.reduce((sum, model) => {
    const codes = getArticleCodes(model);
    return (
      sum +
      modelAllocatedTotal({
        articleValues,
        modelValues,
        model,
        offices,
        articleCodes: codes,
        rowKeyFn,
      })
    );
  }, 0);
}

/**
 * Validation + remaining summaries from a single roll-up pass.
 */
export function computeAllocationStatus({
  divisions,
  salesGroupName,
  targets,
  articleValues,
  modelValues,
  officesForDivision,
  getModelsForDivision,
  getArticleCodesForModel,
  dsModelTotalFn,
  rowKeyFn,
}) {
  const errors = [];
  const remainingModels = [];
  const brandSummaries = [];
  let totalDs = 0;
  let totalAllocated = 0;

  for (const division of divisions) {
    const models = getModelsForDivision(division).filter(
      (model) => dsModelTotalFn(targets, division.name, salesGroupName, model) > 0
    );
    if (models.length === 0) continue;

    const divOffices = officesForDivision(division);
    const dsBrand = models.reduce(
      (s, model) => s + dsModelTotalFn(targets, division.name, salesGroupName, model),
      0
    );
    let allocatedBrand = 0;

    for (const model of models) {
      const dsTotal = dsModelTotalFn(targets, division.name, salesGroupName, model);
      const articleCodes = getArticleCodesForModel(division.name, model);
      const hasArticles = modelHasArticles(articleCodes);

      const allocated = modelAllocatedTotal({
        articleValues,
        modelValues,
        model,
        offices: divOffices,
        articleCodes,
        rowKeyFn,
      });

      allocatedBrand += allocated;
      totalDs += dsTotal;
      totalAllocated += allocated;

      if (allocated > dsTotal) {
        errors.push({
          type: "over",
          division: division.name,
          model,
          dsTotal,
          allocated,
          diff: allocated - dsTotal,
          hasArticles,
        });
      } else if (allocated > 0 && allocated < dsTotal) {
        remainingModels.push({
          division: division.name,
          model,
          dsTotal,
          allocated,
          remaining: dsTotal - allocated,
          hasArticles,
        });
      } else if (allocated === 0 && dsTotal > 0) {
        remainingModels.push({
          division: division.name,
          model,
          dsTotal,
          allocated: 0,
          remaining: dsTotal,
          hasArticles,
        });
      }
    }

    brandSummaries.push({
      division: division.name,
      dsBrand,
      allocatedBrand,
      remaining: dsBrand - allocatedBrand,
    });

    if (allocatedBrand > dsBrand) {
      errors.push({
        type: "brand_over",
        division: division.name,
        dsTotal: dsBrand,
        allocated: allocatedBrand,
        diff: allocatedBrand - dsBrand,
      });
    }
  }

  const isFullyAllocated =
    totalDs > 0 &&
    totalAllocated === totalDs &&
    errors.length === 0 &&
    remainingModels.length === 0;

  return {
    errors,
    remainingModels: remainingModels.filter((r) => r.remaining > 0),
    brandSummaries,
    totalDs,
    totalAllocated,
    isFullyAllocated,
  };
}

/**
 * Build save payload: only leaf editable values.
 */
export function buildLeafSavePayload({
  divisions,
  salesGroupName,
  targets,
  articleValues,
  modelValues,
  officesForDivision,
  getModelsForDivision,
  getArticleCodesForModel,
  dsModelTotalFn,
  rowKeyFn,
}) {
  const articles = [];
  const models = [];

  for (const division of divisions) {
    const modelList = getModelsForDivision(division).filter(
      (model) => dsModelTotalFn(targets, division.name, salesGroupName, model) > 0
    );
    const divOffices = officesForDivision(division);

    for (const model of modelList) {
      const articleCodes = getArticleCodesForModel(division.name, model);
      const hasArticles = modelHasArticles(articleCodes);

      if (hasArticles) {
        for (const code of articleCodes) {
          for (const office of divOffices) {
            const units = parseUnits(
              articleValues[rowKeyFn(model, office.name, code)]
            );
            articles.push({
              brand: division.name,
              sales_group: salesGroupName,
              model,
              article_code: code,
              sales_office: office.name,
              target_units: units,
            });
          }
        }
      } else {
        for (const office of divOffices) {
          const units = parseUnits(modelValues[rowKeyFn(model, office.name)]);
          models.push({
            brand: division.name,
            sales_group: salesGroupName,
            model,
            sales_office: office.name,
            target_units: units,
          });
        }
      }
    }
  }

  return { articles, models };
}

/**
 * Server-side: derive model office totals from article leaf rows.
 */
export function deriveModelTotalsFromArticleLeaves(articleLeaves) {
  const map = new Map();
  for (const row of articleLeaves) {
    if (!row.brand || !row.model || !row.sales_office) continue;
    const units = Number(row.target_units) || 0;
    if (units <= 0) continue;
    const key = `${row.brand}::${row.sales_group}::${row.model}::${row.sales_office}`;
    const prev = map.get(key) || {
      brand: row.brand,
      sales_group: row.sales_group,
      model: row.model,
      sales_office: row.sales_office,
      target_units: 0,
    };
    prev.target_units += units;
    map.set(key, prev);
  }
  return [...map.values()];
}
