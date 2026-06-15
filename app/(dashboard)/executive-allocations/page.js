import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanContextBanner } from "@/components/plan/plan-context-banner";
import { InlineUnitsEditor } from "@/components/allocations/inline-units-editor";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { ReconciliationPanel } from "@/components/reconciliation-panel";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan } from "@/lib/data";
import { calculateReconciliation } from "@/lib/workflow";
import { isExecutiveAllocationAllowed, EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE } from "@/lib/retail-allocation";
import { SALES_EXECUTIVES } from "@/lib/constants";
import { planLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export default async function ExecutiveAllocationsPage({ searchParams }) {
  await requirePageAccess("/executive-allocations");
  const params = await searchParams;
  const plan = await getActivePlan(params?.plan);
  const supabase = await createClient();
  const canAllocate = plan ? isExecutiveAllocationAllowed(plan.status) : false;

  const { data: offices } = plan
    ? await supabase
        .from("sales_office_allocations")
        .select("*")
        .eq("planning_period_id", plan.id)
    : { data: [] };

  const officeIds = (offices || []).map((o) => o.id);

  const { data: executives } = officeIds.length
    ? await supabase
        .from("executive_allocations")
        .select("*, sales_office_allocations(sales_office, units)")
        .in("sales_office_allocation_id", officeIds)
    : { data: [] };

  const officeOptions = (offices || []).map((o) => ({
    value: o.id,
    label: o.sales_office,
  }));

  const execTotal = (executives || []).reduce((s, e) => s + e.units, 0);
  const officeTotal = (offices || []).reduce((s, o) => s + o.units, 0);
  const balanced = officeTotal === execTotal;
  const result = plan && canAllocate ? await calculateReconciliation(supabase, plan.id) : null;

  const grouped = (offices || []).map((office) => ({
    office,
    executives: (executives || []).filter((e) => e.sales_office_allocation_id === office.id),
  }));

  return (
    <>
      <Header
        title="Executive Allocation"
        description="Assign office targets to sales executives and reconcile the plan"
      />

      {plan && <PlanContextBanner plan={plan} basePath="/executive-allocations" />}

      {plan && !canAllocate && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>{EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE}</p>
        </div>
      )}

      {plan && canAllocate && officeOptions.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Office targets</p>
                <p className="text-2xl font-bold">{officeTotal.toLocaleString()} units</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Executive allocations</p>
                <p className={cn("text-2xl font-bold", balanced ? "text-emerald-700" : "text-red-700")}>
                  {execTotal.toLocaleString()} units
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add executive allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AddAllocationForm
                type="executives"
                periodId={plan.id}
                options={{ offices: officeOptions, executives: SALES_EXECUTIVES }}
                fields={[
                  {
                    label: "Monthly Target Plan",
                    type: "display",
                    value: planLabel(plan.month, plan.year),
                  },
                  { name: "sales_office_allocation_id", label: "Sales Office", type: "select", optionsKey: "offices" },
                  { name: "sales_executive", label: "Sales Executive", type: "select", optionsKey: "executives" },
                  { name: "units", label: "Units", type: "number" },
                ]}
              />
            </CardContent>
          </Card>

          {grouped.map(({ office, executives: officeExecs }) => (
            <Card key={office.id}>
              <CardHeader>
                <CardTitle>{office.sales_office} — {office.units} units</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {officeExecs.length === 0 ? (
                  <p className="text-sm text-slate-500">No executive allocations yet.</p>
                ) : (
                  officeExecs.map((executive) => (
                    <div
                      key={executive.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                    >
                      <p className="font-medium text-slate-900">{executive.sales_executive}</p>
                      <InlineUnitsEditor
                        type="executives"
                        recordId={executive.id}
                        field="units"
                        value={executive.units}
                        periodId={plan.id}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}

          <ReconciliationPanel periodId={plan.id} initialResult={result} />
        </div>
      )}

      {plan && canAllocate && officeOptions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No sales office allocations are available for this plan yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}
