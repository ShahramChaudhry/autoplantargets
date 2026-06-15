import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getQueuePlan } from "@/lib/data";
import { isAwaitingMDApproval } from "@/lib/workflow";
import { STATUS_LABELS } from "@/lib/constants";
import { formatAuditEntry } from "@/lib/audit";
import { planLabel } from "@/lib/plans";

export default async function ApprovalQueuePage({ searchParams }) {
  const user = await requirePageAccess("/approval-queue");
  const params = await searchParams;
  const plan = await getQueuePlan(user.role, params?.plan);
  const supabase = await createClient();

  const { data: targets } = plan
    ? await supabase.from("targets").select("*").eq("planning_period_id", plan.id).order("brand")
    : { data: [] };

  const { data: reviewNotes } = plan
    ? await supabase
        .from("audit_logs")
        .select("*, users(name)")
        .eq("planning_period_id", plan.id)
        .in("action", ["b2b_approve", "b2b_request_changes"])
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const total = (targets || []).reduce((s, t) => s + t.target_units, 0);
  const awaitingApproval = isAwaitingMDApproval(plan?.status);

  return (
    <>
      <Header
        title="Approval Queue"
        description="Final executive review of monthly target plans"
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
              {!awaitingApproval && (
                <p className="text-sm text-amber-700">
                  This plan is not currently awaiting MD approval.
                </p>
              )}
              <WorkflowActions periodId={plan.id} status={plan.status} role={user.role} />
            </CardContent>
          </Card>

          {reviewNotes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>B2B Review Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reviewNotes.map((log) => {
                  const entry = formatAuditEntry(log, plan);
                  return (
                    <div key={log.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <span className="font-medium">{entry.userName}</span>
                      {entry.role && (
                        <span className="text-slate-500"> · {entry.role}</span>
                      )}
                      <p className="mt-1 text-slate-700">{entry.headline}</p>
                      {entry.subline && <p className="text-slate-600">{entry.subline}</p>}
                      {entry.comment && (
                        <p className="mt-1 text-slate-600">&ldquo;{entry.comment}&rdquo;</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
