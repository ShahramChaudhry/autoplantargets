import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanContextBanner } from "@/components/plan/plan-context-banner";
import { InlineUnitsEditor } from "@/components/allocations/inline-units-editor";
import { DeleteAllocationButton } from "@/components/allocations/delete-allocation-button";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { RetailAllocationProgress } from "@/components/allocations/retail-allocation-progress";
import { RetailAllocationLockBanner } from "@/components/allocations/retail-allocation-lock-banner";
import { RetailAllocationCompletion } from "@/components/allocations/retail-allocation-completion";
import { CompleteRetailAllocationAction } from "@/components/workflow/complete-retail-allocation-action";
import { createClient } from "@/lib/supabase/server";
import {
  getRetailAllocationProgress,
  isRetailAllocationCompleteStatus,
  isRetailAllocationEditable,
} from "@/lib/retail-allocation";
import { planLabel } from "@/lib/plans";
import { getSalesOffices } from "@/src/data";

export async function RetailAllocationContent({ plan, user }) {
  if (!plan) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No monthly target plan is available for retail allocation yet.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const { data: offices } = await supabase
    .from("sales_office_allocations")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("sales_office");

  const { data: retailTargets } = await supabase
    .from("targets")
    .select("target_units")
    .eq("planning_period_id", plan.id)
    .eq("sales_group", "Retail");

  const retailTotal = (retailTargets || []).reduce((sum, target) => sum + target.target_units, 0);
  const officeTotal = (offices || []).reduce((sum, office) => sum + office.units, 0);
  const progress = getRetailAllocationProgress(retailTotal, officeTotal);
  const isEditable = isRetailAllocationEditable(plan.status);
  const isComplete = isRetailAllocationCompleteStatus(plan.status);
  const officeOptions = [...getSalesOffices("Toyota"), ...getSalesOffices("Honda")].map(
    (o) => o.name
  );

  const { data: completionLog } = isComplete
    ? await supabase
        .from("audit_logs")
        .select("created_at, users(name, role)")
        .eq("planning_period_id", plan.id)
        .eq("action", "complete_retail_allocation")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <PlanContextBanner plan={plan} basePath="/allocations" />

      <RetailAllocationProgress
        retailTarget={retailTotal}
        allocated={officeTotal}
        isComplete={isComplete}
      />

      {isComplete && (
        <>
          <RetailAllocationCompletion
            completedBy={completionLog?.users?.name || user.name}
            completedByRole={completionLog?.users?.role || user.role}
            completedAt={completionLog?.created_at}
          />
          <RetailAllocationLockBanner />
        </>
      )}

      {isEditable && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add office allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AddAllocationForm
                type="offices"
                periodId={plan.id}
                options={{ offices: officeOptions }}
                fields={[
                  {
                    label: "Monthly Target Plan",
                    type: "display",
                    value: planLabel(plan.month, plan.year),
                  },
                  {
                    name: "sales_office",
                    label: "Sales Office",
                    type: "select",
                    optionsKey: "offices",
                  },
                  { name: "units", label: "Units", type: "number" },
                ]}
              />
            </CardContent>
          </Card>

          <CompleteRetailAllocationAction
            periodId={plan.id}
            planName={planLabel(plan.month, plan.year)}
            retailTarget={retailTotal}
            allocated={officeTotal}
            status={plan.status}
            canComplete={progress.isFullyAllocated}
          />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sales office allocations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(offices || []).length === 0 ? (
            <p className="text-sm text-slate-500">No sales office allocations yet.</p>
          ) : (
            (offices || []).map((office) => (
              <div
                key={office.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
              >
                <p className="font-medium text-slate-900">{office.sales_office}</p>
                <div className="flex items-center gap-2">
                  <InlineUnitsEditor
                    type="offices"
                    recordId={office.id}
                    field="units"
                    value={office.units}
                    periodId={plan.id}
                    disabled={!isEditable}
                  />
                  {isEditable && (
                    <DeleteAllocationButton
                      type="offices"
                      id={office.id}
                      periodId={plan.id}
                      label={`Delete ${office.sales_office} allocation`}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
