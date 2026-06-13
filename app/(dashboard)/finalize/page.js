import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { PeriodSelector } from "@/components/period-selector";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { formatPeriod } from "@/lib/utils";
import { Suspense } from "react";
import { Lock } from "lucide-react";

export default async function FinalizePage({ searchParams }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);

  return (
    <>
      <Header
        title="Finalize Targets"
        description="Step 8: Lock approved targets for retail allocation"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {formatPeriod(period.month, period.year)}
              </CardTitle>
              <Badge variant={getStatusBadgeVariant(period.status)}>{period.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <WorkflowStatus status={period.status} />
            <p className="text-sm text-slate-600">
              Once finalized, targets become read-only for the Demand & Supply team and are
              released to the National Performance Manager for Sales Office allocation.
            </p>
            <WorkflowActions periodId={period.id} status={period.status} role={user.role} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
