import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getQueuePlan } from "@/lib/data";
import { isAwaitingB2BReview } from "@/lib/workflow";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel } from "@/lib/plans";

export default async function ReviewQueuePage({ searchParams }) {
  const user = await requirePageAccess("/review-queue");
  const params = await searchParams;
  const plan = await getQueuePlan(user.role, params?.plan);
  const supabase = await createClient();

  const { data: targets } = plan
    ? await supabase.from("targets").select("*").eq("planning_period_id", plan.id).order("brand")
    : { data: [] };

  const total = (targets || []).reduce((s, t) => s + t.target_units, 0);
  const awaitingReview = isAwaitingB2BReview(plan?.status);

  return (
    <>
      <Header
        title="Review Queue"
        description="Review submitted monthly target plans and approve or request changes"
      />

      {plan && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{planLabel(plan.month, plan.year)} Monthly Target Plan</CardTitle>
                <Badge variant={getStatusBadgeVariant(plan.status)}>
                  {STATUS_LABELS[plan.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowStatus status={plan.status} />
              {!awaitingReview && (
                <p className="text-sm text-amber-700">
                  This plan is not currently awaiting B2B review.
                </p>
              )}
              <WorkflowActions periodId={plan.id} status={plan.status} role={user.role} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Target Summary — {total.toLocaleString()} units</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(targets || []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">{t.brand}</p>
                    <p className="text-sm text-slate-500">{t.sales_group}</p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{t.target_units}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
