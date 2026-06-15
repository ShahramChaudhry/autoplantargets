import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { PlanSelector } from "@/components/plan/plan-selector";
import { ModelAllocationGroups } from "@/components/allocations/model-allocation-groups";
import { PlanLockBanner } from "@/components/plan/plan-lock-banner";
import { WorkflowGuideCard } from "@/components/plan/workflow-guide";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan, getPlanningPeriods } from "@/lib/data";
import { isPlanEditable } from "@/lib/workflow";
import { planStepPath } from "@/lib/plans";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function ModelAllocationsPage({ searchParams }) {
  await requirePageAccess("/model-allocations");
  const params = await searchParams;
  const plans = await getPlanningPeriods();
  const plan = params?.plan
    ? await getActivePlan(params.plan)
    : plans[0] || null;

  let targets = [];
  let allocations = [];

  if (plan) {
    const supabase = await createClient();
    const { data: targetRows } = await supabase
      .from("targets")
      .select("*")
      .eq("planning_period_id", plan.id);

    targets = targetRows || [];
    const targetIds = targets.map((t) => t.id);

    if (targetIds.length) {
      const { data: allocationRows } = await supabase
        .from("model_allocations")
        .select("*")
        .in("target_id", targetIds)
        .order("model");
      allocations = allocationRows || [];
    }
  }

  return (
    <>
      <Header title="Model Allocation" description="Distribute brand targets across vehicle models" />
      <DemandSupplyStepper currentStep="models" plan={plan} />

      <Suspense fallback={null}>
        <PlanSelector plans={plans} currentPlan={plan} />
      </Suspense>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-slate-600">Create a monthly target plan to start model allocation.</p>
          <Link href="/monthly-target-plans" className={cn(buttonVariants(), "mt-4 gap-2")}>
            <Plus className="h-4 w-4" />
            Create Monthly Target Plan
          </Link>
        </div>
      ) : !plan ? (
        <p className="text-sm text-slate-500">Select a monthly target plan above.</p>
      ) : targets.length === 0 ? (
        <WorkflowGuideCard
          title="Add targets before allocating models"
          description="Create brand targets for this plan, then return here to allocate models."
          actionLabel="Go to Target Creation"
          actionHref={planStepPath("/targets", plan.month, plan.year)}
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
