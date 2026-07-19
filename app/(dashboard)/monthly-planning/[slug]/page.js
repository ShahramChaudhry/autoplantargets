import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PlanLifecycleCard } from "@/components/workflow/plan-lifecycle-card";
import { PlanningStepContent } from "@/components/plan/planning-step-content";
import { requirePageAccess } from "@/lib/auth";
import { getPlanningPeriods } from "@/lib/data";
import { findPlanBySlug, planLabel, normalizeStepKey } from "@/lib/plans";
import { DEMAND_SUPPLY_WORKFLOW_STEPS } from "@/lib/constants";

const LEGACY_TO_TARGETS = new Set(["plan", "models", "articles", "review", "submit"]);

const STEP_META = {
  targets: {
    title: () => "Monthly Planning",
    description: "Enter targets, then save a draft or submit directly for B2B review",
  },
};

export default async function MonthlyPlanningPlanPage({ params, searchParams }) {
  const user = await requirePageAccess("/monthly-planning");
  const { slug } = await params;
  const query = await searchParams;
  let step = normalizeStepKey(query?.step || "targets");

  if (LEGACY_TO_TARGETS.has(step)) {
    redirect(`/monthly-planning/${slug}?step=targets`);
  }

  const validStep = DEMAND_SUPPLY_WORKFLOW_STEPS.some((s) => s.key === step);
  if (!validStep) {
    redirect(`/monthly-planning/${slug}?step=targets`);
  }

  const periods = await getPlanningPeriods();
  const plan = findPlanBySlug(periods, slug);

  if (!plan) {
    notFound();
  }

  const label = planLabel(plan.month, plan.year);
  const meta = STEP_META[step] || STEP_META.targets;

  return (
    <>
      <Header title={meta.title(label)} description={meta.description} />
      <PlanLifecycleCard plan={plan} />
      <PlanningStepContent step={step} plan={plan} periods={periods} user={user} />
    </>
  );
}
