/**
 * Pure hierarchical roll-up for NPM Sales Office Allocation.
 *
 * For models with articles, allocation is exclusive:
 *   mode "model"   → save model×office (article_code null)
 *   mode "article" → save article×office; model displays roll-up
 *   mode "none"    → both cells available until the user chooses a source
 *
 * Brand totals always derive from effective model totals.
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

/**
 * Detect exclusive allocation source for a model.
 * @returns {"none"|"model"|"article"}
 */
export function detectModelAllocationMode({
  articleValues,
  modelValues,
  model,
  offices,
  articleCodes,
  rowKeyFn,
}) {
  if (!modelHasArticles(articleCodes)) {
    return "model";
  }

  let articleSum = 0;
  let modelSum = 0;
  for (const office of offices) {
    articleSum += rollupModelOfficeFromArticles({
      articleValues,
      model,
      officeName: office.name,
      articleCodes,
      rowKeyFn,
    });
    modelSum += parseUnits(modelValues[rowKeyFn(model, office.name)]);
  }

  // Article wins if both somehow present (should not persist together)
  if (articleSum > 0) return "article";
  if (modelSum > 0) return "model";
  return "none";
}

export function allocationModeLabel(mode) {
  if (mode === "article") return "Article allocation";
  if (mode === "model") return "Model allocation";
  return "Model or article";
}

/** Model office cells: editable when mode is none/model (or model has no articles). */
export function isModelOfficeEditable(mode, articleCodes) {
  if (!modelHasArticles(articleCodes)) return true;
  return mode === "none" || mode === "model";
}

/** Article office cells: editable when mode is none/article. */
export function isArticleOfficeEditable(mode, articleCodes) {
  if (!modelHasArticles(articleCodes)) return false;
  return mode === "none" || mode === "article";
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
 * Effective model×office units from the active exclusive source.
 */
export function effectiveModelOfficeUnits({
  articleValues,
  modelValues,
  model,
  officeName,
  articleCodes,
  rowKeyFn,
  offices,
}) {
  const mode = detectModelAllocationMode({
    articleValues,
    modelValues,
    model,
    offices: offices || [{ name: officeName }],
    articleCodes,
    rowKeyFn,
  });

  if (mode === "article") {
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

export function clearModelValuesForModel(modelValues, model, offices, rowKeyFn) {
  const next = { ...modelValues };
  for (const office of offices) {
    next[rowKeyFn(model, office.name)] = "";
  }
  return next;
}

export function clearArticleValuesForModel(
  articleValues,
  model,
  offices,
  articleCodes,
  rowKeyFn
) {
  const next = { ...articleValues };
  for (const code of articleCodes || []) {
    for (const office of offices) {
      next[rowKeyFn(model, office.name, code)] = "";
    }
  }
  return next;
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
  offices,
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
        offices,
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
        offices,
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
      const mode = detectModelAllocationMode({
        articleValues,
        modelValues,
        model,
        offices: divOffices,
        articleCodes,
        rowKeyFn,
      });

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
          mode,
        });
      } else if (allocated > 0 && allocated < dsTotal) {
        remainingModels.push({
          division: division.name,
          model,
          dsTotal,
          allocated,
          remaining: dsTotal - allocated,
          hasArticles,
          mode,
        });
      } else if (allocated === 0 && dsTotal > 0) {
        remainingModels.push({
          division: division.name,
          model,
          dsTotal,
          allocated: 0,
          remaining: dsTotal,
          hasArticles,
          mode,
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
 * Build save payload: exclusive leaf source per model.
 * Never includes both model and article leaves for the same model.
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
      const mode = detectModelAllocationMode({
        articleValues,
        modelValues,
        model,
        offices: divOffices,
        articleCodes,
        rowKeyFn,
      });

      if (mode === "article") {
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
      } else if (mode === "model") {
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
      // mode === "none": nothing to save for this model
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
