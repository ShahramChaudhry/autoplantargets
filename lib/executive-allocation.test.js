import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isExecutiveAllocationEditable,
  isExecutiveAllocationCompleteStatus,
} from "./executive-allocation-status.js";

describe("executive-allocation editability", () => {
  it("keeps BM editable until the plan is fully completed", () => {
    assert.equal(isExecutiveAllocationEditable("retail_allocation"), true);
    assert.equal(isExecutiveAllocationEditable("executive_allocation"), true);
    assert.equal(isExecutiveAllocationEditable("reconciliation_failed"), true);
    assert.equal(isExecutiveAllocationEditable("completed"), false);
    assert.equal(isExecutiveAllocationEditable("finalized"), false);
  });

  it("marks only completed as the terminal complete status", () => {
    assert.equal(isExecutiveAllocationCompleteStatus("completed"), true);
    assert.equal(isExecutiveAllocationCompleteStatus("executive_allocation"), false);
    assert.equal(isExecutiveAllocationCompleteStatus("retail_allocation"), false);
  });
});
