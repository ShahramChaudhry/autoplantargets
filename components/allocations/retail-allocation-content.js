import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanContextBanner } from "@/components/plan/plan-context-banner";
import { RetailAllocationProgress } from "@/components/allocations/retail-allocation-progress";
import { RetailAllocationLockBanner } from "@/components/allocations/retail-allocation-lock-banner";
import { RetailAllocationCompletion } from "@/components/allocations/retail-allocation-completion";
import { CompleteRetailAllocationAction } from "@/components/workflow/complete-retail-allocation-action";
import { NpmOfficeAllocationPanel } from "@/components/allocations/npm-office-allocation-panel";
import { createClient } from "@/lib/supabase/server";
import {
  getRetailAllocationProgress,
  isRetailAllocationCompleteStatus,
  isRetailAllocationEditable,
  fetchRetailAllocationTotals,
} from "@/lib/retail-allocation";
import { getPlanningPeriods } from "@/lib/data";
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
  const periods = await getPlanningPeriods();

  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("brand");

  const targetIds = (targets || []).filter((t) => !t.sales_office).map((t) => t.id);
  let modelAllocations = [];
  let articleAllocations = [];

  if (targetIds.length) {
    const { data: modelRows } = await supabase
      .from("model_allocations")
      .select("*")
      .in("target_id", targetIds);
    modelAllocations = modelRows || [];

    const modelIds = modelAllocations.map((m) => m.id);
    if (modelIds.length) {
      const { data: articleRows } = await supabase
        .from("article_allocations")
        .select("*")
        .in("model_allocation_id", modelIds);
      articleAllocations = articleRows || [];
    }
  }

  const { retailTarget, allocated } = await fetchRetailAllocationTotals(supabase, plan.id);
  const progress = getRetailAllocationProgress(retailTarget, allocated);
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
        retailTarget={retailTarget}
        allocated={allocated}
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
            Sales Office Allocation — {planLabel(plan.month, plan.year)}
          </CardTitle>
          <p className="text-sm text-slate-500">
            Same Model × Sales Office grid format as planning. Values on the left come from Demand
            &amp; Supply; enter how each model is split across offices.
          </p>
        </CardHeader>
        <CardContent>
          <NpmOfficeAllocationPanel
            plan={plan}
            targets={targets || []}
            modelAllocations={modelAllocations}
            articleAllocations={articleAllocations}
            periods={periods}
            editable={isEditable}
            user={user}
          />
        </CardContent>
      </Card>

      {isEditable && (
        <CompleteRetailAllocationAction
          periodId={plan.id}
          planName={planLabel(plan.month, plan.year)}
          retailTarget={retailTarget}
          allocated={allocated}
          status={plan.status}
          canComplete={progress.isFullyAllocated}
        />
      )}
    </div>
  );
}
