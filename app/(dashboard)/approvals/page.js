import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { B2BApprovalReview } from "@/components/approvals/b2b-approval-review";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getQueuePlan, getPlanningPeriods } from "@/lib/data";
import { isAwaitingB2BReview, isAwaitingMDApproval } from "@/lib/workflow";
import { STATUS_LABELS, ROLES } from "@/lib/constants";
import { formatAuditEntry } from "@/lib/audit";
import { planLabel, planSlug } from "@/lib/plans";

async function loadPlanAllocations(supabase, planId) {
  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", planId)
    .order("brand");

  const targetIds = (targets || []).map((t) => t.id);
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

  return { targets: targets || [], modelAllocations, articleAllocations };
}

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

  if (isB2B) {
    const allocationData = plan
      ? await loadPlanAllocations(supabase, plan.id)
      : { targets: [], modelAllocations: [], articleAllocations: [] };

    return (
      <>
        <Header
          title="Approvals"
          description="Review submitted monthly target plans, inspect the planning grid, and approve or request changes"
        />
        <B2BApprovalReview
          plan={plan}
          periods={periods}
          targets={allocationData.targets}
          modelAllocations={allocationData.modelAllocations}
          articleAllocations={allocationData.articleAllocations}
          pendingPlans={pendingPlans}
          awaitingReview={plan ? isAwaitingB2BReview(plan.status) : false}
          user={user}
        />
      </>
    );
  }

  const { targets } = plan
    ? await loadPlanAllocations(supabase, plan.id)
    : { targets: [] };

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
  const awaiting = isAwaitingMDApproval(plan?.status);

  return (
    <>
      <Header
        title="Approvals"
        description="Final executive review of plans approved by the B2B Director"
      />

      <div className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pending Final Approvals
        </h2>
        {pendingPlans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              No plans are currently awaiting final MD approval.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingPlans.map((p) => {
              const slug = planSlug(p.month, p.year);
              return (
                <a
                  key={p.id}
                  href={`/approvals?plan=${slug}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="font-medium">{planLabel(p.month, p.year)}</p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[p.status]}</p>
                </a>
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
                <CardTitle>Plan for final approval — {planLabel(plan.month, plan.year)}</CardTitle>
                <Badge variant={getStatusBadgeVariant(plan.status)}>
                  {STATUS_LABELS[plan.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowStatus status={plan.status} />
              {!awaiting && (
                <p className="text-sm text-amber-700">
                  This plan is not currently awaiting MD approval.
                </p>
              )}
              <WorkflowActions
                periodId={plan.id}
                status={plan.status}
                role={user.role}
                showCommentAlways
                commentLabel="Review comments"
              />
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
                      {entry.role && <span className="text-slate-500"> · {entry.role}</span>}
                      <p className="mt-1 text-slate-700">{entry.headline}</p>
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
                      <p className="font-medium text-slate-900">
                        {t.brand} {t.model ? `· ${t.model}` : ""}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t.sales_group}
                        {t.sales_office ? ` · ${t.sales_office}` : ""}
                      </p>
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
