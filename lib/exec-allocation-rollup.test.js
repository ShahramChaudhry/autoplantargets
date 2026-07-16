import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExecSavePayload,
  buildOfficeModelTargets,
  cellKey,
  computeExecAllocationStatus,
  execRowTotal,
  isOfficeInScope,
  modelColumnAllocated,
  parseUnits,
} from "./exec-allocation-rollup.js";

const executives = [
  { id: "102341", name: "Ashraf Abd El Qader" },
  { id: "103132", name: "Mahesh Acharya" },
  { id: "103191", name: "Jafar Kamal" },
];

const models = [
  { brand: "Toyota", model: "Corolla", officeTarget: 50 },
  { brand: "Toyota", model: "Camry", officeTarget: 40 },
  { brand: "Toyota", model: "Yaris", officeTarget: 30 },
];

describe("exec-allocation-rollup", () => {
  it("loads office model targets from NPM leaf rows (ignores other offices)", () => {
    const targets = [
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Toyota-Dubai - DFC",
        article_code: null,
        target_units: 50,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Camry",
        sales_office: "Toyota-Dubai - DFC",
        article_code: null,
        target_units: 40,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Yaris",
        sales_office: "Toyota-Dubai - DFC",
        article_code: null,
        target_units: 30,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Toyota-Dubai - SZR",
        article_code: null,
        target_units: 99,
      },
    ];
    const officeModels = buildOfficeModelTargets(
      targets,
      "Retail",
      "Toyota-Dubai - DFC"
    );
    assert.equal(officeModels.length, 3);
    assert.equal(
      officeModels.find((m) => m.model === "Corolla").officeTarget,
      50
    );
    assert.ok(!officeModels.some((m) => m.officeTarget === 99));
  });

  it("sums article leaves for office model target when present", () => {
    const targets = [
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Toyota-Dubai - DFC",
        article_code: "COR-GLI-2026",
        target_units: 20,
      },
      {
        brand: "Toyota",
        sales_group: "Retail",
        model: "Corolla",
        sales_office: "Toyota-Dubai - DFC",
        article_code: "COR-XLI-2026",
        target_units: 30,
      },
    ];
    const officeModels = buildOfficeModelTargets(
      targets,
      "Retail",
      "Toyota-Dubai - DFC"
    );
    assert.equal(officeModels[0].officeTarget, 50);
  });

  it("distributes one model among multiple executives", () => {
    const values = {
      [cellKey("102341", "Corolla")]: "20",
      [cellKey("103132", "Corolla")]: "15",
      [cellKey("103191", "Corolla")]: "15",
    };
    assert.equal(
      modelColumnAllocated(
        values,
        executives.map((e) => e.id),
        "Corolla"
      ),
      50
    );
  });

  it("one executive may receive multiple models; row total sums models", () => {
    const values = {
      [cellKey("102341", "Corolla")]: "20",
      [cellKey("102341", "Camry")]: "10",
      [cellKey("102341", "Yaris")]: "5",
    };
    assert.equal(execRowTotal(values, models, "102341"), 35);
  });

  it("column roll-ups match office model targets when fully allocated", () => {
    const values = {
      [cellKey("102341", "Corolla")]: "20",
      [cellKey("103132", "Corolla")]: "15",
      [cellKey("103191", "Corolla")]: "15",
      [cellKey("102341", "Camry")]: "10",
      [cellKey("103132", "Camry")]: "15",
      [cellKey("103191", "Camry")]: "15",
      [cellKey("102341", "Yaris")]: "5",
      [cellKey("103132", "Yaris")]: "10",
      [cellKey("103191", "Yaris")]: "15",
    };
    const status = computeExecAllocationStatus({ values, models, executives });
    assert.equal(status.allocatedTotal, 120);
    assert.equal(status.officeTotal, 120);
    assert.equal(status.isFullyAllocated, true);
    assert.equal(status.remainingModels.length, 0);
  });

  it("blocks over-allocation", () => {
    const values = {
      [cellKey("102341", "Corolla")]: "30",
      [cellKey("103132", "Corolla")]: "30",
    };
    const status = computeExecAllocationStatus({ values, models, executives });
    assert.equal(status.hasOver, true);
    assert.equal(status.isFullyAllocated, false);
    assert.ok(status.modelStatuses.find((m) => m.model === "Corolla").over);
  });

  it("draft save payload includes zeros; empty cells are zero", () => {
    const values = { [cellKey("102341", "Corolla")]: "20" };
    assert.equal(parseUnits(""), 0);
    const payload = buildExecSavePayload({
      values,
      models: [models[0]],
      executives: [executives[0]],
      salesGroup: "Retail",
      salesOffice: "Toyota-Dubai - DFC",
    });
    assert.equal(payload.length, 1);
    assert.equal(payload[0].target_units, 20);
    assert.equal(payload[0].article_code, null);
  });

  it("completion requires all models to reconcile", () => {
    const partial = {
      [cellKey("102341", "Corolla")]: "40",
      [cellKey("102341", "Camry")]: "35",
      [cellKey("102341", "Yaris")]: "25",
    };
    const status = computeExecAllocationStatus({
      values: partial,
      models,
      executives,
    });
    assert.equal(status.isFullyAllocated, false);
    assert.equal(status.remainingTotal, 20);
    assert.ok(status.remainingModels.some((m) => m.model === "Corolla"));
  });

  it("branch manager office scope check", () => {
    assert.equal(
      isOfficeInScope(["Toyota-Dubai - DFC", "Toyota-Dubai - SZR"], "Toyota-Dubai - DFC"),
      true
    );
    assert.equal(
      isOfficeInScope(["Toyota-Dubai - DFC"], "Toyota-Sharjah HUB"),
      false
    );
    assert.equal(isOfficeInScope("all", "Anywhere"), true);
  });
});
