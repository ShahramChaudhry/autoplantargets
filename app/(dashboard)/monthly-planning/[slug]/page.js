import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { PlanningStepContent } from "@/components/plan/planning-step-content";
import { requirePageAccess } from "@/lib/auth";
import { getPlanningPeriods } from "@/lib/data";
import { findPlanBySlug, planLabel, normalizeStepKey } from "@/lib/plans";
import { DEMAND_SUPPLY_WORKFLOW_STEPS } from "@/lib/constants";

const STEP_META = {
  plan: {
    title: (label) => label,
    description: "Monthly target plan workspace",
  },
  targets: {
    title: () => "Target Creation",
    description: "Enter monthly targets by brand, sales group, and sales office",
  },
  models: {
    title: () => "Model Allocation",
    description: "Distribute brand targets across vehicle models",
  },
  articles: {
    title: () => "Article Allocation",
    description: "Break down model targets by article code (optional)",
  },
  review: {
    title: () => "Review",
    description: "Review plan completeness before submission",
  },
  submit: {
    title: () => "Submit",
    description: "Submit your plan for B2B and MD approval",
  },
};

export default async function MonthlyPlanningPlanPage({ params, searchParams }) {
  const user = await requirePageAccess("/monthly-planning");
  const { slug } = await params;
  const query = await searchParams;
  const step = normalizeStepKey(query?.step || "plan");
  const validStep = DEMAND_SUPPLY_WORKFLOW_STEPS.some((s) => s.key === step);

  if (!validStep) {
    redirect(`/monthly-planning/${slug}`);
  }

  const periods = await getPlanningPeriods();
  const plan = findPlanBySlug(periods, slug);

  if (!plan) {
    notFound();
  }

  const label = planLabel(plan.month, plan.year);
  const meta = STEP_META[step];

  return (
    <>
      <Header title={meta.title(label)} description={meta.description} />
      <DemandSupplyStepper currentStep={step} plan={plan} />
      <PlanningStepContent step={step} plan={plan} periods={periods} user={user} />
    </>
  );
}
