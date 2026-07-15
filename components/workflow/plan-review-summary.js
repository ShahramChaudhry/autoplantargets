"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkflowPipeline } from "@/components/workflow/workflow-pipeline";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel, planStepPath, isArticleAllocationSkipped } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Check, Minus, ArrowRight } from "lucide-react";

function StatusRow({ label, ok, skipped }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
      <p className="font-medium text-slate-900">{label}</p>
      {skipped ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
          <Minus className="h-4 w-4" />
          Skipped
        </span>
      ) : ok ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <Check className="h-4 w-4" />
          Completed
        </span>
      ) : (
        <span className="text-sm font-medium text-slate-500">Incomplete</span>
      )}
    </div>
  );
}

export function PlanReviewSummary({ plan, stats }) {
  const articlesSkipped = isArticleAllocationSkipped(plan);
  const articlesComplete = !articlesSkipped && (stats?.articleCount || 0) > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{planLabel(plan.month, plan.year)} — Plan Review</CardTitle>
            <Badge variant={getStatusBadgeVariant(plan.status)}>
              {STATUS_LABELS[plan.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <WorkflowPipeline status={plan.status} />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Total Target Units</p>
              <p className="text-2xl font-bold">{(stats?.totalUnits ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Model Lines</p>
              <p className="text-2xl font-bold">{stats?.modelCount ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Article Lines</p>
              <p className="text-2xl font-bold">
                {articlesSkipped ? "—" : stats?.articleCount ?? 0}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <StatusRow label="Target Creation" ok={(stats?.targetCount || 0) > 0} />
            <StatusRow label="Model Allocation" ok={(stats?.modelCount || 0) > 0} />
            <StatusRow
              label="Article Allocation"
              ok={articlesComplete}
              skipped={articlesSkipped}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={planStepPath("submit", plan.month, plan.year)}
              className={cn(buttonVariants(), "gap-2")}
            >
              Continue to Submit
              <ArrowRight className="h-4 w-4" />
            </Link>
            {articlesSkipped && (
              <Link
                href={planStepPath("articles", plan.month, plan.year)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Complete Article Allocation
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function UnskipArticleButton({ plan, editable }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!plan || !editable || !isArticleAllocationSkipped(plan)) return null;

  async function handleUnskip() {
    setLoading(true);
    try {
      const res = await fetch("/api/plans/article-skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: plan.id, skipped: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to reopen article allocation");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-900">
          Article Allocation was skipped. You can reopen it and complete it before submission.
        </p>
        <Button variant="outline" size="sm" onClick={handleUnskip} disabled={loading}>
          {loading ? "Reopening..." : "Reopen Article Allocation"}
        </Button>
      </div>
    </div>
  );
}
