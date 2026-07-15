import { CompleteRetailAllocationAction } from "@/components/workflow/complete-retail-allocation-action";
import { NpmOfficeAllocationPanel } from "@/components/allocations/npm-office-allocation-panel";
import { createClient } from "@/lib/supabase/server";
import {
  getRetailAllocationProgress,
  isRetailAllocationEditable,
  fetchRetailAllocationTotals,
} from "@/lib/retail-allocation";
import { getPlanningPeriods } from "@/lib/data";
import { planLabel } from "@/lib/plans";

export async function RetailAllocationContent({ plan, user }) {
  if (!plan) {
    return (
      <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No monthly target plan is available for retail allocation yet.
      </div>
    );
  }

  const supabase = await createClient();
  const periods = await getPlanningPeriods();

  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("brand");

  const { retailTarget, allocated } = await fetchRetailAllocationTotals(supabase, plan.id);
  const progress = getRetailAllocationProgress(retailTarget, allocated);
  const isEditable = isRetailAllocationEditable(plan.status);

  return (
    <div className="space-y-6">
      <NpmOfficeAllocationPanel
        plan={plan}
        targets={targets || []}
        periods={periods}
        editable={isEditable}
        user={user}
      />

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
