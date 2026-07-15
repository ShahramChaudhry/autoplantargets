import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocationModeLabel,
  brandAllocatedTotal,
  buildLeafSavePayload,
  clearArticleValuesForModel,
  clearModelValuesForModel,
  computeAllocationStatus,
  deriveModelTotalsFromArticleLeaves,
  detectModelAllocationMode,
  effectiveModelOfficeUnits,
  isArticleOfficeEditable,
  isBrandOfficeEditable,
  isModelOfficeEditable,
  modelAllocatedTotal,
  modelHasArticles,
  parseUnits,
  rollupBrandOfficeUnits,
  rollupModelOfficeFromArticles,
} from "./npm-allocation-rollup.js";

/** Matches src/data/helpers.js rowKey(model, office, articleCode) */
function rowKey(model, office, article) {
  return article ? `${model}::${article}::${office}` : `${model}::${office}`;
}

const offices = [{ name: "Dubai DFC" }, { name: "Abu Dhabi" }];
const corollaArticles = ["COR-GLI-2026", "COR-XLI-2026", "COR-HYB-2026"];

describe("npm-allocation-rollup", () => {
  it("a) article values roll up to model when in article mode", () => {
    const articleValues = {
      [rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")]: "20",
      [rowKey("Corolla", "Dubai DFC", "COR-XLI-2026")]: "20",
      [rowKey("Corolla", "Dubai DFC", "COR-HYB-2026")]: "10",
    };

    assert.equal(
      rollupModelOfficeFromArticles({
        articleValues,
        model: "Corolla",
        officeName: "Dubai DFC",
        articleCodes: corollaArticles,
        rowKeyFn: rowKey,
      }),
      50
    );

    assert.equal(
      detectModelAllocationMode({
        articleValues,
        modelValues: { [rowKey("Corolla", "Dubai DFC")]: "20" },
        model: "Corolla",
        offices,
        articleCodes: corollaArticles,
        rowKeyFn: rowKey,
      }),
      "article"
    );

    assert.equal(
      effectiveModelOfficeUnits({
        articleValues,
        modelValues: { [rowKey("Corolla", "Dubai DFC")]: "20" },
        model: "Corolla",
        officeName: "Dubai DFC",
        articleCodes: corollaArticles,
        rowKeyFn: rowKey,
        offices,
      }),
      50,
      "stale model value must be ignored in article mode"
    );
  });

  it("a2) model-level value is used when articles are empty", () => {
    const modelValues = { [rowKey("Corolla", "Dubai DFC")]: "50" };
    assert.equal(
      detectModelAllocationMode({
        articleValues: {},
        modelValues,
        model: "Corolla",
        offices,
        articleCodes: corollaArticles,
        rowKeyFn: rowKey,
      }),
      "model"
    );
    assert.equal(
      effectiveModelOfficeUnits({
        articleValues: {},
        modelValues,
        model: "Corolla",
        officeName: "Dubai DFC",
        articleCodes: corollaArticles,
        rowKeyFn: rowKey,
        offices,
      }),
      50
    );
  });

  it("b) model values roll up to brand", () => {
    const articleValues = {
      [rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")]: "20",
      [rowKey("Corolla", "Dubai DFC", "COR-XLI-2026")]: "20",
      [rowKey("Corolla", "Dubai DFC", "COR-HYB-2026")]: "10",
    };
    const modelValues = {
      [rowKey("Camry", "Dubai DFC")]: "40",
      [rowKey("Yaris", "Dubai DFC")]: "30",
    };

    const brandOffice = rollupBrandOfficeUnits({
      articleValues,
      modelValues,
      models: ["Corolla", "Camry", "Yaris"],
      officeName: "Dubai DFC",
      getArticleCodes: (m) => (m === "Corolla" ? corollaArticles : []),
      rowKeyFn: rowKey,
      offices,
    });

    assert.equal(brandOffice, 120);

    const brandTotal = brandAllocatedTotal({
      articleValues,
      modelValues,
      models: ["Corolla", "Camry", "Yaris"],
      offices,
      getArticleCodes: (m) => (m === "Corolla" ? corollaArticles : []),
      rowKeyFn: rowKey,
    });
    assert.equal(brandTotal, 120);
  });

  it("c) exclusive editability: model OR article, brand never editable", () => {
    assert.equal(isBrandOfficeEditable(), false);
    assert.equal(modelHasArticles(corollaArticles), true);

    assert.equal(isModelOfficeEditable("none", corollaArticles), true);
    assert.equal(isArticleOfficeEditable("none", corollaArticles), true);

    assert.equal(isModelOfficeEditable("model", corollaArticles), true);
    assert.equal(isArticleOfficeEditable("model", corollaArticles), false);

    assert.equal(isModelOfficeEditable("article", corollaArticles), false);
    assert.equal(isArticleOfficeEditable("article", corollaArticles), true);

    assert.equal(isModelOfficeEditable("model", []), true);
    assert.equal(isArticleOfficeEditable("model", []), false);

    assert.equal(allocationModeLabel("model"), "Model allocation");
    assert.equal(allocationModeLabel("article"), "Article allocation");
  });

  it("d) remaining totals use rolled-up values", () => {
    const targets = [
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: null,
        target_units: 50,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Camry",
        sales_office: null,
        target_units: 40,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Yaris",
        sales_office: null,
        target_units: 30,
      },
    ];

    const articleValues = {
      [rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")]: "20",
      [rowKey("Corolla", "Dubai DFC", "COR-XLI-2026")]: "20",
      [rowKey("Corolla", "Dubai DFC", "COR-HYB-2026")]: "10",
    };
    const modelValues = {
      [rowKey("Camry", "Dubai DFC")]: "40",
      [rowKey("Yaris", "Dubai DFC")]: "30",
    };

    const status = computeAllocationStatus({
      divisions: [{ name: "Toyota" }],
      salesGroupName: "Retail",
      targets,
      articleValues,
      modelValues,
      officesForDivision: () => offices,
      getModelsForDivision: () => ["Corolla", "Camry", "Yaris"],
      getArticleCodesForModel: (_, model) =>
        model === "Corolla" ? corollaArticles : [],
      dsModelTotalFn: (tgts, brand, sg, model) => {
        const row = tgts.find(
          (t) =>
            t.brand === brand &&
            t.sales_group === sg &&
            t.model === model &&
            (t.sales_office == null || t.sales_office === "")
        );
        return Number(row?.target_units) || 0;
      },
      rowKeyFn: rowKey,
    });

    assert.equal(status.totalAllocated, 120);
    assert.equal(status.totalDs, 120);
    assert.equal(status.remainingModels.length, 0);
    assert.equal(status.isFullyAllocated, true);
    assert.equal(status.brandSummaries[0].allocatedBrand, 120);
    assert.equal(status.brandSummaries[0].remaining, 0);
  });

  it("e) over-allocation is blocked via status errors", () => {
    const targets = [
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: null,
        target_units: 50,
      },
    ];
    const articleValues = {
      [rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")]: "30",
      [rowKey("Corolla", "Dubai DFC", "COR-XLI-2026")]: "30",
    };

    const status = computeAllocationStatus({
      divisions: [{ name: "Toyota" }],
      salesGroupName: "Retail",
      targets,
      articleValues,
      modelValues: {},
      officesForDivision: () => offices,
      getModelsForDivision: () => ["Corolla"],
      getArticleCodesForModel: () => corollaArticles,
      dsModelTotalFn: () => 50,
      rowKeyFn: rowKey,
    });

    assert.ok(status.errors.some((e) => e.type === "over" && e.model === "Corolla"));
    assert.equal(status.isFullyAllocated, false);
  });

  it("f) models without articles remain editable via modelValues", () => {
    assert.equal(modelHasArticles([]), false);

    const units = effectiveModelOfficeUnits({
      articleValues: {},
      modelValues: { [rowKey("Camry", "Dubai DFC")]: "40" },
      model: "Camry",
      officeName: "Dubai DFC",
      articleCodes: [],
      rowKeyFn: rowKey,
      offices,
    });
    assert.equal(units, 40);

    const total = modelAllocatedTotal({
      articleValues: {},
      modelValues: {
        [rowKey("Camry", "Dubai DFC")]: "25",
        [rowKey("Camry", "Abu Dhabi")]: "15",
      },
      model: "Camry",
      offices,
      articleCodes: [],
      rowKeyFn: rowKey,
    });
    assert.equal(total, 40);
  });

  it("f2) save payload is exclusive — model mode OR article mode", () => {
    const payloadModel = buildLeafSavePayload({
      divisions: [{ name: "Toyota" }],
      salesGroupName: "Retail",
      targets: [
        {
          brand: "Toyota",
          sales_group: "Retail",
          model: "Corolla",
          sales_office: null,
          target_units: 50,
        },
      ],
      articleValues: {},
      modelValues: { [rowKey("Corolla", "Dubai DFC")]: "50" },
      officesForDivision: () => [{ name: "Dubai DFC" }],
      getModelsForDivision: () => ["Corolla"],
      getArticleCodesForModel: () => corollaArticles,
      dsModelTotalFn: () => 50,
      rowKeyFn: rowKey,
    });
    assert.equal(payloadModel.models.length, 1);
    assert.equal(payloadModel.models[0].target_units, 50);
    assert.equal(payloadModel.articles.length, 0);

    const payloadArticle = buildLeafSavePayload({
      divisions: [{ name: "Toyota" }],
      salesGroupName: "Retail",
      targets: [
        {
          brand: "Toyota",
          sales_group: "Retail",
          model: "Corolla",
          sales_office: null,
          target_units: 50,
        },
      ],
      articleValues: {
        [rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")]: "50",
      },
      modelValues: { [rowKey("Corolla", "Dubai DFC")]: "999" },
      officesForDivision: () => [{ name: "Dubai DFC" }],
      getModelsForDivision: () => ["Corolla"],
      getArticleCodesForModel: () => corollaArticles,
      dsModelTotalFn: () => 50,
      rowKeyFn: rowKey,
    });
    assert.ok(payloadArticle.articles.some((a) => a.article_code === "COR-GLI-2026"));
    assert.equal(payloadArticle.models.length, 0);
  });

  it("clear helpers wipe the inactive source", () => {
    const modelValues = clearModelValuesForModel(
      { [rowKey("Corolla", "Dubai DFC")]: "50" },
      "Corolla",
      [{ name: "Dubai DFC" }],
      rowKey
    );
    assert.equal(modelValues[rowKey("Corolla", "Dubai DFC")], "");

    const articleValues = clearArticleValuesForModel(
      { [rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")]: "20" },
      "Corolla",
      [{ name: "Dubai DFC" }],
      corollaArticles,
      rowKey
    );
    assert.equal(articleValues[rowKey("Corolla", "Dubai DFC", "COR-GLI-2026")], "");
  });

  it("parseUnits ignores blanks and negatives", () => {
    assert.equal(parseUnits(""), 0);
    assert.equal(parseUnits("-5"), 0);
    assert.equal(parseUnits("12"), 12);
  });

  it("deriveModelTotalsFromArticleLeaves sums by brand/model/office", () => {
    const derived = deriveModelTotalsFromArticleLeaves([
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Dubai DFC",
        target_units: 20,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Dubai DFC",
        target_units: 30,
      },
    ]);
    assert.equal(derived.length, 1);
    assert.equal(derived[0].target_units, 50);
  });
});
