"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getModelsForBrand, isValidBrandModel } from "@/lib/constants";

export function ModelAllocationForm({ plan, targets, allocations, editable = true }) {
  const router = useRouter();
  const brandsWithTargets = useMemo(
    () => [...new Set(targets.map((t) => t.brand))],
    [targets]
  );

  const [brand, setBrand] = useState(brandsWithTargets[0] || "");
  const [salesGroup, setSalesGroup] = useState("");
  const [model, setModel] = useState("");
  const [units, setUnits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const salesGroupsForBrand = useMemo(
    () => targets.filter((t) => t.brand === brand).map((t) => t.sales_group),
    [targets, brand]
  );

  const modelsForBrand = useMemo(() => getModelsForBrand(brand), [brand]);

  const selectedTarget = useMemo(
    () => targets.find((t) => t.brand === brand && t.sales_group === salesGroup),
    [targets, brand, salesGroup]
  );

  const remaining = useMemo(() => {
    if (!selectedTarget) return null;
    const allocated = allocations
      .filter((a) => a.target_id === selectedTarget.id)
      .reduce((sum, a) => sum + a.units, 0);
    return selectedTarget.target_units - allocated;
  }, [selectedTarget, allocations]);

  useEffect(() => {
    if (salesGroupsForBrand.length && !salesGroupsForBrand.includes(salesGroup)) {
      setSalesGroup(salesGroupsForBrand[0]);
    }
  }, [salesGroupsForBrand, salesGroup]);

  useEffect(() => {
    setModel("");
  }, [brand]);

  function handleBrandChange(value) {
    setBrand(value);
    setSalesGroup("");
    setModel("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!selectedTarget) {
      setError("No target exists for this brand and sales group. Create it in Target Creation first.");
      return;
    }

    if (!isValidBrandModel(brand, model)) {
      setError(`"${model}" is not a valid model for ${brand}.`);
      return;
    }

    const unitValue = parseInt(units, 10) || 0;
    if (unitValue <= 0) {
      setError("Units must be greater than zero.");
      return;
    }

    if (remaining !== null && unitValue > remaining) {
      setError(`Cannot allocate ${unitValue} units. Only ${remaining} units remaining for ${brand} ${salesGroup}.`);
      return;
    }

    const duplicate = allocations.some(
      (a) => a.target_id === selectedTarget.id && a.model === model
    );
    if (duplicate) {
      setError(`${model} is already allocated for ${brand} ${salesGroup}. Edit the existing row instead.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "models",
          periodId: plan.id,
          data: {
            target_id: selectedTarget.id,
            model,
            units: unitValue,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add allocation");
        return;
      }

      setUnits("");
      setModel("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (brandsWithTargets.length === 0 || !editable) return null;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="space-y-2">
        <Label>Brand</Label>
        <Select value={brand} onChange={(e) => handleBrandChange(e.target.value)} required>
          {brandsWithTargets.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Sales Group</Label>
        <Select
          value={salesGroup}
          onChange={(e) => {
            setSalesGroup(e.target.value);
            setModel("");
            setError("");
          }}
          required
        >
          {salesGroupsForBrand.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
          disabled={!brand}
        >
          <option value="">Select model...</option>
          {modelsForBrand.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Units</Label>
        <Input
          type="number"
          min="1"
          max={remaining ?? undefined}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder={remaining != null ? `Max ${remaining}` : "Units"}
          required
        />
      </div>
      <Button type="submit" disabled={loading || !model}>
        {loading ? "Adding..." : "Add Allocation"}
      </Button>
      {error && (
        <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-5">{error}</p>
      )}
      {remaining != null && salesGroup && (
        <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-5">
          {remaining} units remaining for {brand} {salesGroup}
        </p>
      )}
    </form>
  );
}
