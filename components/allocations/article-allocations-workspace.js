"use client";

import { useState, Suspense } from "react";
import { PlanSelector } from "@/components/plan/plan-selector";
import { CreatePlanModal } from "@/components/plan/create-plan-modal";
import { ArticleAllocationGroups } from "@/components/allocations/article-allocation-groups";
import { WorkflowGuideCard } from "@/components/plan/workflow-guide";
import { PlanLockBanner } from "@/components/plan/plan-lock-banner";
import { isPlanEditable } from "@/lib/workflow";
import { planStepPath } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function ArticleAllocationsWorkspace({ plans, plan, targets, models, articles }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (plans.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-slate-600">No Monthly Target Plans found.</p>
          <Button className="mt-4 gap-2" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Monthly Target Plan
          </Button>
        </div>
        <CreatePlanModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          redirectBase="/article-allocations"
        />
      </>
    );
  }

  const editable = plan ? isPlanEditable(plan.status) : false;

  return (
    <>
      <Suspense fallback={null}>
        <PlanSelector plans={plans} currentPlan={plan} />
      </Suspense>

      {plan && !editable && <PlanLockBanner />}

      {!plan ? (
        <p className="text-sm text-slate-500">Select a monthly target plan above.</p>
      ) : models.length === 0 ? (
        <WorkflowGuideCard
          title="No model allocations have been created yet."
          description="Complete model allocation for this plan, then return here to assign article codes."
          actionLabel="Go to Model Allocation"
          actionHref={planStepPath("/model-allocations", plan.month, plan.year)}
        />
      ) : (
        <ArticleAllocationGroups
          plan={plan}
          targets={targets}
          models={models}
          articles={articles}
          editable={editable}
        />
      )}
    </>
  );
}
