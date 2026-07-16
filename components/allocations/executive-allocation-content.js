import { ExecModelAllocationPanel } from "@/components/allocations/exec-model-allocation-panel";
import { ReconciliationPanel } from "@/components/reconciliation-panel";
import { createClient } from "@/lib/supabase/server";
import { calculateReconciliation } from "@/lib/workflow";
import {
  isExecutiveAllocationAllowed,
  EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE,
} from "@/lib/retail-allocation";
import {
  getBranchManagerOfficeNames,
  getExecutivesForOffice,
  isExecutiveAllocationEditable,
} from "@/lib/executive-allocation";
import { getPlanningPeriods } from "@/lib/data";
import { getDivisionsForUser, getUnionOfficesForUser } from "@/src/data";
import { AlertCircle } from "lucide-react";

export async function ExecutiveAllocationContent({ plan, user }) {
  if (!plan) {
    return (
      <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No monthly target plan is available for executive allocation yet.
      </div>
    );
  }

  const supabase = await createClient();
  const periods = await getPlanningPeriods();
  const canStart = isExecutiveAllocationAllowed(plan.status);
  const isEditable = isExecutiveAllocationEditable(plan.status);

  const divisions = getDivisionsForUser(user);
  const offices = getUnionOfficesForUser(user, divisions);
  const allowedNames = getBranchManagerOfficeNames(user);

  const executivesByOffice = {};
  for (const office of offices) {
    executivesByOffice[office.name] = getExecutivesForOffice(user, office.name);
  }

  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("brand");

  let existingAllocations = [];
  if (allowedNames.length > 0) {
    const { data, error } = await supabase
      .from("sales_exec_targets")
      .select("*")
      .eq("planning_period_id", plan.id)
      .in("sales_office", allowedNames);
    if (!error) existingAllocations = data || [];
  }

  const result = canStart ? await calculateReconciliation(supabase, plan.id) : null;

  return (
    <div className="space-y-6">
      {!canStart && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>{EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE}</p>
        </div>
      )}

      {canStart && (
        <>
          <ExecModelAllocationPanel
            plan={plan}
            targets={targets || []}
            existingAllocations={existingAllocations}
            periods={periods}
            offices={offices}
            executivesByOffice={executivesByOffice}
            editable={isEditable}
            defaultOfficeName={offices[0]?.name || ""}
          />

          {!isEditable && (
            <p className="text-xs text-slate-500">
              Sales executive allocation is complete for this plan and is read-only.
            </p>
          )}

          <ReconciliationPanel periodId={plan.id} initialResult={result} />
        </>
      )}
    </div>
  );
}
