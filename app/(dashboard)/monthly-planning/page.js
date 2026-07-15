import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { CreateFirstPlan } from "@/components/plan/create-first-plan";
import { requirePageAccess } from "@/lib/auth";
import { getPlanningPeriods } from "@/lib/data";
import { planSlug } from "@/lib/plans";

export default async function MonthlyPlanningPage() {
  await requirePageAccess("/monthly-planning");
  const periods = await getPlanningPeriods();

  if (periods.length > 0) {
    const plan = periods[0];
    redirect(`/monthly-planning/${planSlug(plan.month, plan.year)}?step=targets`);
  }

  return (
    <>
      <Header
        title="Monthly Planning"
        description="Select a month to start entering targets by division and sales group"
      />
      <CreateFirstPlan />
    </>
  );
}
