import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { requirePageAccess } from "@/lib/auth";
import { getDashboardStats, getPlanningPeriods } from "@/lib/data";
import { findPlanBySlug, planLabel } from "@/lib/plans";

export default async function MonthlyTargetPlanWorkspacePage({ params }) {
  await requirePageAccess("/monthly-target-plans");
  const { slug } = await params;
  const plans = await getPlanningPeriods();
  const plan = findPlanBySlug(plans, slug);

  if (!plan) {
    notFound();
  }

  const stats = await getDashboardStats(plan.id);

  return (
    <>
      <Header
        title={planLabel(plan.month, plan.year)}
        description="Monthly target plan workspace"
      />
      <DemandSupplyStepper currentStep="plan" plan={plan} />
      <PlanWorkspace plan={plan} stats={stats} />
    </>
  );
}
