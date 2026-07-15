import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getQueuePlan, getPlanningPeriods } from "@/lib/data";
import { isAwaitingB2BReview, isAwaitingMDApproval } from "@/lib/workflow";
import { STATUS_LABELS, ROLES } from "@/lib/constants";
import { formatAuditEntry } from "@/lib/audit";
import { planLabel, planSlug } from "@/lib/plans";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function ApprovalsPage({ searchParams }) {
  const user = await requirePageAccess("/approvals");
  const params = await searchParams;
  const isB2B = user.role === ROLES.B2B_DIRECTOR;
  const isMD = user.role === ROLES.MANAGING_DIRECTOR;

  const periods = await getPlanningPeriods();
  const pendingPlans = periods.filter((p) =>
    isB2B ? isAwaitingB2BReview(p.status) : isAwaitingMDApproval(p.status)
  );

  const plan = await getQueuePlan(user.role, params?.plan);
  const supabase = await createClient();

  const { data: targets } = plan
    ? await supabase.from("targets").select("*").eq("planning_period_id", plan.id).order("brand")
    : { data: [] };

  const { data: reviewNotes } =
    plan && isMD
      ? await supabase
          .from("audit_logs")
          .select("*, users(name)")
          .eq("planning_period_id", plan.id)
          .in("action", ["b2b_approve", "b2b_request_changes"])
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] };

  const total = (targets || []).reduce((s, t) => s + t.target_units, 0);
  const awaiting = isB2B
    ? isAwaitingB2BReview(plan?.status)
    : isAwaitingMDApproval(plan?.status);

  return (
    <>
      <Header
        title="Approvals"
        description={
          isB2B
            ? "Review submitted monthly target plans and approve or request changes"
            : "Final executive review of plans approved by the B2B Director"
        }
      />

      <div className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {isB2B ? "Pending Reviews" : "Pending Final Approvals"}
        </h2>
        {pendingPlans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              {isB2B
                ? "No plans are currently awaiting B2B review."
                : "No plans are currently awaiting final MD approval."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingPlans.map((p) => {
              const slug = planSlug(p.month, p.year);
              const active = plan?.id === p.id;
              return (
                <Link
                  key={p.id}
                  href={`/approvals?plan=${slug}`}
                  className={cn(
                    "rounded-xl border px-4 py-3 transition-colors",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <p className="font-medium">{planLabel(p.month, p.year)}</p>
                  <p className={cn("text-xs", active ? "text-slate-300" : "text-slate-500")}>
                    {STATUS_LABELS[p.status]}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {plan && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  {isB2B ? "Open Plan" : "Plan for final approval"} —{" "}
                  {planLabel(plan.month, plan.year)}
                </CardTitle>
                <Badge variant={getStatusBadgeVariant(plan.status)}>
                  {STATUS_LABELS[plan.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowStatus status={plan.status} />
              {!awaiting && (
                <p className="text-sm text-amber-700">
                  {isB2B
                    ? "This plan is not currently awaiting B2B review."
                    : "This plan is not currently awaiting MD approval. Only plans approved by the B2B Director appear here."}
                </p>
              )}
              <WorkflowActions periodId={plan.id} status={plan.status} role={user.role} />
            </CardContent>
          </Card>

          {isMD && reviewNotes?.length > 0 && (
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
                      {entry.role && <span className="text-slate-500"> · {entry.role}</span>}
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
              {(targets || []).length === 0 ? (
                <p className="text-sm text-slate-500">No targets on this plan yet.</p>
              ) : (
                (targets || []).map((t) => (
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
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
