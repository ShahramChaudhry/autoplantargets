import Link from "next/link";
import { Suspense } from "react";
import { TargetEntryPanel } from "@/components/targets/target-entry-panel";
import { PlanSelector } from "@/components/plan/plan-selector";
import { ModelAllocationGroups } from "@/components/allocations/model-allocation-groups";
import { ArticleAllocationsWorkspace } from "@/components/allocations/article-allocations-workspace";
import { PlanLockBanner } from "@/components/plan/plan-lock-banner";
import { EmptyPlansGuide, WorkflowGuideCard } from "@/components/plan/workflow-guide";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { MonthlyPlansClient } from "@/components/plan/monthly-plans-client";
import { PlanReviewSummary, UnskipArticleButton } from "@/components/workflow/plan-review-summary";
import {
  SkipArticleAllocationAction,
  ContinueAfterArticlesActions,
} from "@/components/workflow/skip-article-allocation";
import { WorkflowPipeline } from "@/components/workflow/workflow-pipeline";
import { WorkflowActions } from "@/components/workflow-actions";
import { FinalizePlanAction } from "@/components/workflow/finalize-plan-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isPlanEditable } from "@/lib/workflow";
import { STATUS_LABELS } from "@/lib/constants";
import {
  planLabel,
  planStepPath,
  isArticleAllocationSkipped,
} from "@/lib/plans";
import { getDashboardStats, getPlansWithSummaries } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export async function PlanningStepContent({ step, plan, periods, user }) {
  if (step === "plan" && !plan) {
    const plans = await getPlansWithSummaries();
    return <MonthlyPlansClient plans={plans} />;
  }

  if (step === "plan" && plan) {
    const stats = await getDashboardStats(plan.id);
    return <PlanWorkspace plan={plan} stats={stats} />;
  }

  if (!plan) {
    return <EmptyPlansGuide />;
  }

  if (step === "targets") {
    return <TargetsStep plan={plan} periods={periods} user={user} />;
  }

  if (step === "models") {
    return <ModelsStep plan={plan} periods={periods} />;
  }

  if (step === "articles") {
    return <ArticlesStep plan={plan} periods={periods} />;
  }

  if (step === "review") {
    return <ReviewStep plan={plan} />;
  }

  if (step === "submit") {
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

  const editable = isPlanEditable(plan.status);

  return (
    <>
      {!editable && <PlanLockBanner />}
      <TargetEntryPanel
        plan={plan}
        targets={targets || []}
        periods={periods}
        editable={editable}
        user={user}
      />
    </>
  );
}

async function ModelsStep({ plan, periods }) {
  const supabase = await createClient();
  const { data: targetRows } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id);

  const targets = targetRows || [];
  const targetIds = targets.map((t) => t.id);
  let allocations = [];

  if (targetIds.length) {
    const { data: allocationRows } = await supabase
      .from("model_allocations")
      .select("*")
      .in("target_id", targetIds)
      .order("model");
    allocations = allocationRows || [];
  }

  return (
    <>
      <Suspense fallback={null}>
        <PlanSelector plans={periods} currentPlan={plan} />
      </Suspense>

      {targets.length === 0 ? (
        <WorkflowGuideCard
          title="Add targets before allocating models"
          description="Create brand targets for this plan, then return here to allocate models."
          actionLabel="Go to Target Creation"
          actionHref={planStepPath("targets", plan.month, plan.year)}
        />
      ) : (
        <>
          {!isPlanEditable(plan.status) && <PlanLockBanner />}
          <ModelAllocationGroups
            plan={plan}
            targets={targets}
            allocations={allocations}
            editable={isPlanEditable(plan.status)}
          />
        </>
      )}
    </>
  );
}

async function ArticlesStep({ plan, periods }) {
  const supabase = await createClient();
  const editable = isPlanEditable(plan.status);
  const skipped = isArticleAllocationSkipped(plan);

  const { data: targetRows } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("brand");

  const targets = targetRows || [];
  const targetIds = targets.map((t) => t.id);
  let models = [];
  let articles = [];

  if (targetIds.length) {
    const { data: modelRows } = await supabase
      .from("model_allocations")
      .select("*")
      .in("target_id", targetIds)
      .order("model");
    models = modelRows || [];
  }

  const modelIds = models.map((m) => m.id);
  if (modelIds.length) {
    const { data: articleRows } = await supabase
      .from("article_allocations")
      .select("*")
      .in("model_allocation_id", modelIds);
    articles = articleRows || [];
  }

  return (
    <>
      <UnskipArticleButton plan={plan} editable={editable} />
      {skipped ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <p className="font-medium text-amber-900">Article Allocation skipped</p>
          <p className="mt-1 text-sm text-amber-800">
            This optional step was skipped. You can reopen it above before final submission, or
            continue to Review.
          </p>
        </div>
      ) : (
        <SkipArticleAllocationAction plan={plan} editable={editable && models.length > 0} />
      )}
      {!skipped && (
        <ArticleAllocationsWorkspace
          plans={periods}
          plan={plan}
          targets={targets}
          models={models}
          articles={articles}
        />
      )}
      <ContinueAfterArticlesActions
        plan={plan}
        hasArticles={articles.length > 0}
        skipped={skipped}
      />
    </>
  );
}

async function ReviewStep({ plan }) {
  const stats = await getDashboardStats(plan.id);
  return <PlanReviewSummary plan={plan} stats={stats} />;
}

async function SubmitStep({ plan, user }) {
  const stats = await getDashboardStats(plan.id);
  const articlesSkipped = isArticleAllocationSkipped(plan);
  const articlesOk = articlesSkipped || (stats?.articleCount || 0) > 0;
  const canSubmit =
    (stats?.targetCount || 0) > 0 && (stats?.modelCount || 0) > 0 && articlesOk;

  return (
    <div className="space-y-6">
      <FinalizePlanAction
        periodId={plan.id}
        planName={planLabel(plan.month, plan.year)}
        status={plan.status}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{planLabel(plan.month, plan.year)} — Ready to submit?</CardTitle>
            <Badge variant={getStatusBadgeVariant(plan.status)}>
              {STATUS_LABELS[plan.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <WorkflowPipeline status={plan.status} />

          <div className="space-y-2 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-900">Pre-submit checklist</p>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>
                Target Creation:{" "}
                <span className="font-medium text-slate-900">
                  {(stats?.targetCount || 0) > 0 ? "✓ Complete" : "Incomplete"}
                </span>
              </li>
              <li>
                Model Allocation:{" "}
                <span className="font-medium text-slate-900">
                  {(stats?.modelCount || 0) > 0 ? "✓ Complete" : "Incomplete"}
                </span>
              </li>
              <li>
                Article Allocation:{" "}
                <span className="font-medium text-slate-900">
                  {articlesSkipped
                    ? "Skipped"
                    : (stats?.articleCount || 0) > 0
                      ? "✓ Completed"
                      : "Incomplete"}
                </span>
              </li>
            </ul>
          </div>

          {!canSubmit && (
            <p className="text-sm text-amber-700">
              Complete required steps (or skip Article Allocation) before submitting.
            </p>
          )}

          <p className="text-sm text-slate-600">
            When your targets and allocations are complete, submit this monthly target plan for
            review. After B2B approval, the plan is automatically forwarded to the Managing
            Director. Once MD approves, finalize the plan to release it for retail allocation.
          </p>

          {canSubmit && (
            <WorkflowActions periodId={plan.id} status={plan.status} role={user.role} />
          )}

          <Link
            href={planStepPath("review", plan.month, plan.year)}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to Review
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
