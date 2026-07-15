import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sumModelOfficeLeaves } from "./retail-allocation.js";

describe("retail-allocation leaf rollups", () => {
  it("sums article office leaves for models with articles", () => {
    const targets = [
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: null,
        article_code: null,
        target_units: 50,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Dubai DFC",
        article_code: "COR-GLI-2026",
        target_units: 20,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Dubai DFC",
        article_code: "COR-XLI-2026",
        target_units: 20,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Dubai DFC",
        article_code: "COR-HYB-2026",
        target_units: 10,
      },
      // Stale model-office parent must be ignored when article leaves exist
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Dubai DFC",
        article_code: null,
        target_units: 20,
      },
    ];

    assert.equal(sumModelOfficeLeaves(targets, "Toyota", "Retail", "Corolla"), 50);
  });

  it("sums model office leaves when model has no articles", () => {
    const targets = [
      {
        brand: "Acme",
        sales_group: "Retail",
        model: "Widget",
        sales_office: "Dubai DFC",
        article_code: null,
        target_units: 25,
      },
      {
        brand: "Acme",
        sales_group: "Retail",
        model: "Widget",
        sales_office: "Abu Dhabi",
        article_code: null,
        target_units: 15,
      },
    ];

    assert.equal(sumModelOfficeLeaves(targets, "Acme", "Retail", "Widget"), 40);
  });
});
