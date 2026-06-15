"use client";

import Link from "next/link";
import { ModelAllocationForm } from "@/components/allocations/model-allocation-form";
import { InlineUnitsEditor } from "@/components/allocations/inline-units-editor";
import { DeleteAllocationButton } from "@/components/allocations/delete-allocation-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { planStepPath } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { ArrowRight, AlertCircle } from "lucide-react";

export function ModelAllocationGroups({ plan, targets, allocations, editable = true }) {
  const groups = targets.map((target) => {
    const models = allocations.filter((a) => a.target_id === target.id);
    const allocated = models.reduce((sum, m) => sum + m.units, 0);
    const remaining = target.target_units - allocated;
    return { target, models, allocated, remaining };
  });

  const allBalanced = groups.length > 0 && groups.every((g) => g.remaining === 0);
  const hasOverAllocation = groups.some((g) => g.remaining < 0);

  return (
    <div className="space-y-6">
      {editable && targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Model Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelAllocationForm
              plan={plan}
              targets={targets}
              allocations={allocations}
              editable={editable}
            />
          </CardContent>
        </Card>
      )}

      {groups.map(({ target, models, allocated, remaining }) => (
        <Card key={target.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                {target.brand} {target.sales_group}{" "}
                <span className="font-normal text-slate-500">
                  (Target: {target.target_units.toLocaleString()} units)
                </span>
              </CardTitle>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Allocated Units: </span>
                  <span className="font-semibold text-slate-900">{allocated.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500">Remaining Units: </span>
                  <span
                    className={cn(
                      "font-semibold",
                      remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-600" : "text-amber-600"
                    )}
                  >
                    {remaining.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {remaining < 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Over-allocated by {Math.abs(remaining)} units. Reduce model allocations to match the target.
              </div>
            )}
            {models.length === 0 ? (
              <p className="text-sm text-slate-500">No model allocations yet.</p>
            ) : (
              models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                >
                  <p className="font-medium text-slate-900">{model.model}</p>
                  <div className="flex items-center gap-1">
                    <InlineUnitsEditor
                      type="models"
                      recordId={model.id}
                      field="units"
                      value={model.units}
                      periodId={plan.id}
                      disabled={!editable}
                    />
                    {editable && (
                      <DeleteAllocationButton
                        type="models"
                        id={model.id}
                        periodId={plan.id}
                        label={`Delete ${model.model} allocation`}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}

      {groups.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            {!allBalanced && (
              <p className="text-sm text-amber-700">
                {hasOverAllocation
                  ? "Fix over-allocations before continuing."
                  : "All target groups must have zero remaining units before continuing."}
              </p>
            )}
            {allBalanced && (
              <p className="text-sm text-emerald-700">All model allocations are balanced. You can continue.</p>
            )}
          </div>
          {allBalanced ? (
            <Link
              href={planStepPath("/article-allocations", plan.month, plan.year)}
              className={cn(buttonVariants(), "gap-2")}
            >
              Continue to Article Allocation
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span
              className={cn(buttonVariants(), "pointer-events-none gap-2 opacity-50")}
              aria-disabled
            >
              Continue to Article Allocation
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
