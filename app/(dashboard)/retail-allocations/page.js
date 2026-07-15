import { Header } from "@/components/layout/header";
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
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan } from "@/lib/data";
import {
  getRetailAllocationProgress,
  isRetailAllocationCompleteStatus,
  isRetailAllocationEditable,
} from "@/lib/retail-allocation";
import { planLabel } from "@/lib/plans";
import { getSalesOffices } from "@/src/data";

export default async function RetailAllocationsPage({ searchParams }) {
  const user = await requirePageAccess("/retail-allocations");
  const params = await searchParams;
  const plan = await getActivePlan(params?.plan);
  const supabase = await createClient();

  const { data: offices } = plan
    ? await supabase
        .from("sales_office_allocations")
        .select("*")
        .eq("planning_period_id", plan.id)
        .order("sales_office")
    : { data: [] };

  const { data: retailTargets } = plan
    ? await supabase
        .from("targets")
        .select("target_units")
        .eq("planning_period_id", plan.id)
        .eq("sales_group", "Retail")
    : { data: [] };

  const retailTotal = (retailTargets || []).reduce((sum, target) => sum + target.target_units, 0);
  const officeTotal = (offices || []).reduce((sum, office) => sum + office.units, 0);
  const progress = getRetailAllocationProgress(retailTotal, officeTotal);
  const isEditable = plan ? isRetailAllocationEditable(plan.status) : false;
  const isComplete = plan ? isRetailAllocationCompleteStatus(plan.status) : false;
  const officeOptions = [
    ...getSalesOffices("Toyota"),
    ...getSalesOffices("Honda"),
  ];

  const { data: completionLog } =
    plan && isComplete
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
    <>
      <Header
        title="Sales Office Allocation"
        description="Distribute retail targets across sales offices"
      />

      {plan && <PlanContextBanner plan={plan} basePath="/retail-allocations" />}

      {plan && (
        <div className="space-y-6">
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
      )}
    </>
  );
}
