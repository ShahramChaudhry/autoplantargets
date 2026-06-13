import { Header } from "@/components/layout/header";
import { WorkflowStatus } from "@/components/workflow-status";
import { PeriodSelector } from "@/components/period-selector";
import { ReconciliationPanel } from "@/components/reconciliation-panel";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { calculateReconciliation } from "@/lib/workflow";
import { Suspense } from "react";

export default async function ReconciliationPage({ searchParams }) {
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const result = period ? await calculateReconciliation(supabase, period.id) : null;

  return (
    <>
      <Header
        title="Reconciliation"
        description="Step 11: Validate that model targets match sales office and executive allocations"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && (
        <div className="space-y-6">
          <WorkflowStatus status={period.status} />
          <ReconciliationPanel periodId={period.id} initialResult={result} />
        </div>
      )}
    </>
  );
}
