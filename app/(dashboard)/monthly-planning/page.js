import { Header } from "@/components/layout/header";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { PlanningStepContent } from "@/components/plan/planning-step-content";
import { requirePageAccess } from "@/lib/auth";
import { getPlanningPeriods } from "@/lib/data";

export default async function MonthlyPlanningPage() {
  const user = await requirePageAccess("/monthly-planning");
  const periods = await getPlanningPeriods();

  return (
    <>
      <Header
        title="Monthly Planning"
        description="Create and manage monthly planning cycles through a guided workflow"
      />
      <DemandSupplyStepper currentStep="plan" plan={null} />
      <PlanningStepContent step="plan" plan={null} periods={periods} user={user} />
    </>
  );
}
