import Link from "next/link";
import { TargetEntryPanel } from "@/components/targets/target-entry-panel";
import { PlanLockBanner } from "@/components/plan/plan-lock-banner";
import { EmptyPlansGuide } from "@/components/plan/workflow-guide";
import { WorkflowActions } from "@/components/workflow-actions";
import { FinalizePlanAction } from "@/components/workflow/finalize-plan-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isPlanEditable } from "@/lib/workflow";
import { planLabel, planStepPath } from "@/lib/plans";
import { getDashboardStats } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export async function PlanningStepContent({ step, plan, periods, user }) {
  if (!plan) {
    return <EmptyPlansGuide />;
  }

  if (step === "targets" || step === "models" || step === "articles" || step === "plan") {
    return <TargetsStep plan={plan} periods={periods} user={user} />;
  }

  if (step === "review" || step === "submit") {
    return <SubmitStep plan={plan} user={user} />;
  }

  return <EmptyPlansGuide />;
}

async function TargetsStep({ plan, periods, user }) {
  const supabase = await createClient();
  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
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

  const editable = isPlanEditable(plan.status);

  return (
    <>
      {!editable && <PlanLockBanner />}
      <TargetEntryPanel
        plan={plan}
        targets={targets || []}
        modelAllocations={modelAllocations}
        articleAllocations={articleAllocations}
        periods={periods}
        editable={editable}
        user={user}
      />
    </>
  );
}

async function SubmitStep({ plan, user }) {
  const stats = await getDashboardStats(plan.id);
  const hasModelTargets = (stats?.modelTargetCount || 0) > 0;
  const canSubmit = (stats?.targetCount || 0) > 0 && hasModelTargets;

  return (
    <div className="space-y-6">
      <FinalizePlanAction
        periodId={plan.id}
        planName={planLabel(plan.month, plan.year)}
        status={plan.status}
      />

      <Card>
        <CardHeader>
          <CardTitle>{planLabel(plan.month, plan.year)} — Review & Submit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Target Lines</p>
              <p className="text-2xl font-bold">{stats?.targetCount ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Model Allocations</p>
              <p className="text-2xl font-bold">{stats?.modelTargetCount ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Article Lines (optional)</p>
              <p className="text-2xl font-bold">{stats?.articleCount ?? 0}</p>
            </div>
          </div>

          {!canSubmit && (
            <p className="text-sm text-amber-700">
              Enter and save model-level targets in the planning grid before submitting.
            </p>
          )}

          <p className="text-sm text-slate-600">
            When your plan is complete, submit for B2B review. After B2B approval, the plan is
            forwarded to the Managing Director for final approval.
          </p>

          {canSubmit && (
            <WorkflowActions periodId={plan.id} status={plan.status} role={user.role} />
          )}

          <Link
            href={planStepPath("targets", plan.month, plan.year)}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to Planning Grid
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function PlanningEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
      <p className="text-slate-600">Create a monthly target plan to start planning.</p>
      <Link href="/monthly-planning" className={cn(buttonVariants(), "mt-4 gap-2")}>
        <Plus className="h-4 w-4" />
        Create Monthly Target Plan
      </Link>
    </div>
  );
}
