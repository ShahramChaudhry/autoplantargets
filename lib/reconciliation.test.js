import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileLayers } from "./reconciliation.js";

describe("reconcileLayers", () => {
  it("passes when D&S == NPM offices == exec leaves", () => {
    const targets = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: null, article_code: null, target_units: 10 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", article_code: null, target_units: 6 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - SZR", article_code: null, target_units: 4 },
    ];
    const execLeaves = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", target_units: 4 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", target_units: 2 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - SZR", target_units: 4 },
    ];

    const result = reconcileLayers({ targets, execLeaves });
    assert.equal(result.passed, true);
    assert.equal(result.dsSum, 10);
    assert.equal(result.npmSum, 10);
    assert.equal(result.execSum, 10);
    assert.equal(result.allOfficesComplete, true);
  });

  it("fails when exec under-allocates an office leaf", () => {
    const targets = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: null, article_code: null, target_units: 10 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", article_code: null, target_units: 10 },
    ];
    const execLeaves = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", target_units: 7 },
    ];

    const result = reconcileLayers({ targets, execLeaves });
    assert.equal(result.passed, false);
    assert.equal(result.allOfficesComplete, false);
    assert.ok(result.mismatches.some((m) => m.type === "npm_vs_exec"));
    assert.deepEqual(result.incompleteOffices, ["Toyota-Dubai - DFC"]);
  });

  it("fails when NPM offices do not cover D&S total", () => {
    const targets = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: null, article_code: null, target_units: 10 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", article_code: null, target_units: 6 },
    ];
    const execLeaves = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", target_units: 6 },
    ];

    const result = reconcileLayers({ targets, execLeaves });
    assert.equal(result.passed, false);
    assert.ok(result.mismatches.some((m) => m.type === "ds_vs_npm"));
  });

  it("uses article leaf sum for NPM when articles are present", () => {
    const targets = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: null, article_code: null, target_units: 5 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", article_code: "A1", target_units: 3 },
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", article_code: "A2", target_units: 2 },
    ];
    const execLeaves = [
      { sales_group: "Retail", brand: "Toyota", model: "Corolla", sales_office: "Toyota-Dubai - DFC", target_units: 5 },
    ];

    const result = reconcileLayers({ targets, execLeaves });
    assert.equal(result.passed, true);
    assert.equal(result.npmSum, 5);
  });
});
