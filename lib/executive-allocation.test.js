import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isExecutiveAllocationEditable,
  isExecutiveAllocationCompleteStatus,
} from "./executive-allocation-status.js";

describe("executive-allocation editability", () => {
  it("finalized retail and unlocked statuses are editable; completed is read-only", () => {
    assert.equal(isExecutiveAllocationEditable("retail_allocation"), true);
    assert.equal(isExecutiveAllocationEditable("reconciliation_failed"), true);
    assert.equal(isExecutiveAllocationEditable("executive_allocation"), false);
    assert.equal(isExecutiveAllocationEditable("completed"), false);
    assert.equal(isExecutiveAllocationEditable("finalized"), false);
  });

  it("marks complete statuses", () => {
    assert.equal(isExecutiveAllocationCompleteStatus("executive_allocation"), true);
    assert.equal(isExecutiveAllocationCompleteStatus("completed"), true);
    assert.equal(isExecutiveAllocationCompleteStatus("retail_allocation"), false);
  });
});
