"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineUnitsEditor } from "@/components/allocations/inline-units-editor";
import { DeleteAllocationButton } from "@/components/allocations/delete-allocation-button";
import { BRANDS, SALES_GROUPS } from "@/lib/constants";
import { planLabel, planStepPath } from "@/lib/plans";
import { Save, ArrowRight } from "lucide-react";

export function TargetEntryPanel({ plan, targets, editable = true }) {
  const router = useRouter();
  const [brand, setBrand] = useState(BRANDS[0]);
  const [salesGroup, setSalesGroup] = useState(SALES_GROUPS[0]);
  const [targetUnits, setTargetUnits] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const total = targets.reduce((sum, t) => sum + t.target_units, 0);
  const label = planLabel(plan.month, plan.year);

  async function handleAddTarget(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "targets",
          periodId: plan.id,
          data: {
            planning_period_id: plan.id,
            brand,
            sales_group: salesGroup,
            target_units: parseInt(targetUnits, 10) || 0,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to add target");
        return;
      }

      setTargetUnits("");
      setMessage("Target added successfully.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    setSaving(true);
    setMessage("");
    try {
      setMessage("Draft saved. You can continue adding targets or move to model allocation.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-4">
          <p className="text-sm text-slate-500">Selected Plan</p>
          <p className="text-lg font-semibold text-slate-900">{label}</p>
        </CardContent>
      </Card>

      {editable && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTarget} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={brand} onChange={(e) => setBrand(e.target.value)} required>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sales Group</Label>
              <Select value={salesGroup} onChange={(e) => setSalesGroup(e.target.value)} required>
                {SALES_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Units</Label>
              <Input
                type="number"
                min="0"
                value={targetUnits}
                onChange={(e) => setTargetUnits(e.target.value)}
                placeholder="e.g. 450"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Target"}
            </Button>
          </form>
          {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Created Targets</CardTitle>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No targets yet. Use the form above to add your first brand target.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Sales Group</th>
                    <th className="px-4 py-3 text-right">Target Units</th>
                    {editable && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targets.map((target) => (
                    <tr key={target.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-slate-900">{target.brand}</td>
                      <td className="px-4 py-3 text-slate-600">{target.sales_group}</td>
                      <td className="px-4 py-3 text-right">
                        <InlineUnitsEditor
                          type="targets"
                          recordId={target.id}
                          field="target_units"
                          value={target.target_units}
                          periodId={plan.id}
                          disabled={!editable}
                        />
                      </td>
                      {editable && (
                        <td className="px-4 py-3 text-right">
                          <DeleteAllocationButton
                            type="targets"
                            id={target.id}
                            periodId={plan.id}
                            label={`Delete ${target.brand} ${target.sales_group} target`}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm text-slate-500">Total Target Units</p>
          <p className="text-2xl font-bold text-slate-900">{total.toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          )}
          <Link
            href={planStepPath("/model-allocations", plan.month, plan.year)}
            className={cn(buttonVariants(), "gap-2", targets.length === 0 && "pointer-events-none opacity-50")}
            aria-disabled={targets.length === 0}
          >
            Continue to Model Allocation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
