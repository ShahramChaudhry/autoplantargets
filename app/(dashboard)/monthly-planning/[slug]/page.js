import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { PlanningStepContent } from "@/components/plan/planning-step-content";
import { requirePageAccess } from "@/lib/auth";
import { getPlanningPeriods } from "@/lib/data";
import { findPlanBySlug, planLabel, normalizeStepKey } from "@/lib/plans";
import { DEMAND_SUPPLY_WORKFLOW_STEPS } from "@/lib/constants";

const LEGACY_TO_TARGETS = new Set(["plan", "models", "articles", "review"]);

const STEP_META = {
  targets: {
    title: () => "Monthly Planning",
    description: "Select month and sales group, then enter targets by division and model",
  },
  submit: {
    title: () => "Review & Submit",
    description: "Review your plan and submit for B2B approval",
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
  const showStepper = step === "submit";

  return (
    <>
      <Header title={meta.title(label)} description={meta.description} />
      {showStepper && <DemandSupplyStepper currentStep={step} plan={plan} />}
      <PlanningStepContent step={step} plan={plan} periods={periods} user={user} />
    </>
  );
}
