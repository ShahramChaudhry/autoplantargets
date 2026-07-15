import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanContextBanner } from "@/components/plan/plan-context-banner";
import { RetailAllocationProgress } from "@/components/allocations/retail-allocation-progress";
import { RetailAllocationLockBanner } from "@/components/allocations/retail-allocation-lock-banner";
import { RetailAllocationCompletion } from "@/components/allocations/retail-allocation-completion";
import { CompleteRetailAllocationAction } from "@/components/workflow/complete-retail-allocation-action";
import { SalesOfficeAllocationGrid } from "@/components/allocations/sales-office-allocation-grid";
import { createClient } from "@/lib/supabase/server";
import {
  getRetailAllocationProgress,
  isRetailAllocationCompleteStatus,
  isRetailAllocationEditable,
} from "@/lib/retail-allocation";
import { planLabel } from "@/lib/plans";

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
    .select("target_units, brand, model")
    .eq("planning_period_id", plan.id)
    .eq("sales_group", "Retail");

  const retailTotal = (retailTargets || []).reduce((sum, target) => sum + target.target_units, 0);
  const officeTotal = (offices || []).reduce((sum, office) => sum + office.units, 0);
  const progress = getRetailAllocationProgress(retailTotal, officeTotal);
  const isEditable = isRetailAllocationEditable(plan.status);
  const isComplete = isRetailAllocationCompleteStatus(plan.status);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sales Office Allocation Grid — {planLabel(plan.month, plan.year)}
          </CardTitle>
          <p className="text-sm text-slate-500">
            Split the Retail targets created by Demand &amp; Supply across sales offices. This step
            is only for National Performance Manager / Retail Head.
          </p>
        </CardHeader>
        <CardContent>
          {retailTotal <= 0 ? (
            <p className="text-sm text-slate-500">
              No Retail model targets are available yet. Demand &amp; Supply must enter and approve
              Retail Brand → Model targets first.
            </p>
          ) : (
            <SalesOfficeAllocationGrid
              planId={plan.id}
              retailTotal={retailTotal}
              existingAllocations={offices || []}
              editable={isEditable}
            />
          )}
        </CardContent>
      </Card>

      {isEditable && (
        <CompleteRetailAllocationAction
          periodId={plan.id}
          planName={planLabel(plan.month, plan.year)}
          retailTarget={retailTotal}
          allocated={officeTotal}
          status={plan.status}
          canComplete={progress.isFullyAllocated}
        />
      )}
    </div>
  );
}
