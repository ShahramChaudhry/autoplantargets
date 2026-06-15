import { Header } from "@/components/layout/header";
import { MonthlyPlansClient } from "@/components/plan/monthly-plans-client";
import { requirePageAccess } from "@/lib/auth";
import { getPlansWithSummaries } from "@/lib/data";

export default async function MonthlyTargetPlansPage() {
  await requirePageAccess("/monthly-target-plans");
  const plans = await getPlansWithSummaries();

  return (
    <>
      <Header
        title="Monthly Target Plans"
        description="Create and manage monthly planning cycles for your organization"
      />
      <MonthlyPlansClient plans={plans} />
    </>
  );
}
