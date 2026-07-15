"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { TargetEntryPanel } from "@/components/targets/target-entry-panel";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel, planSlug } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export function B2BApprovalReview({
  plan,
  periods,
  targets,
  modelAllocations,
  articleAllocations,
  pendingPlans,
  awaitingReview,
  user,
}) {
  const router = useRouter();

  function handleActionSuccess(action) {
    if (action === "b2b_approve" || action === "b2b_request_changes") {
      const remaining = pendingPlans.filter((p) => p.id !== plan.id);
      if (remaining.length > 0) {
        const next = remaining[0];
        router.push(`/approvals?plan=${planSlug(next.month, next.year)}`);
      } else {
        router.push("/approvals");
      }
    }
  }

  const totalUnits = targets.reduce((s, t) => s + (t.target_units || 0), 0);
  const salesGroups = [...new Set(targets.map((t) => t.sales_group))];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pending Reviews ({pendingPlans.length})
        </h2>
        {pendingPlans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              No plans are currently awaiting B2B review.
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
                    {STATUS_LABELS[p.status]} · submitted for review
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {plan && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{planLabel(plan.month, plan.year)} — Plan Review</CardTitle>
                <Badge variant={getStatusBadgeVariant(plan.status)}>
                  {STATUS_LABELS[plan.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowStatus status={plan.status} />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total Units</p>
                  <p className="text-xl font-bold">{totalUnits.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Target Lines</p>
                  <p className="text-xl font-bold">{targets.length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Sales Groups</p>
                  <p className="text-xl font-bold">{salesGroups.length || "—"}</p>
                </div>
              </div>

              {!awaitingReview && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  This plan is not currently awaiting B2B review.
                </div>
              )}

              {awaitingReview && (
                <WorkflowActions
                  periodId={plan.id}
                  status={plan.status}
                  role={user.role}
                  showCommentAlways
                  commentLabel="Review comments"
                  onSuccess={handleActionSuccess}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Details — Target Grid</CardTitle>
              <p className="text-sm text-slate-500">
                Review submitted targets by sales group, division, and model. Use the sales group
                filter to browse each segment.
              </p>
            </CardHeader>
            <CardContent>
              {targets.length === 0 ? (
                <p className="text-sm text-slate-500">No targets on this plan.</p>
              ) : (
                <TargetEntryPanel
                  plan={plan}
                  targets={targets}
                  modelAllocations={modelAllocations}
                  articleAllocations={articleAllocations}
                  periods={periods}
                  editable={false}
                  readOnly
                  user={user}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
