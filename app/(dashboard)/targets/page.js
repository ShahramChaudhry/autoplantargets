import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { TargetEntryPanel } from "@/components/targets/target-entry-panel";
import { PlanLockBanner } from "@/components/plan/plan-lock-banner";
import { EmptyPlansGuide } from "@/components/plan/workflow-guide";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan, getPlanningPeriods } from "@/lib/data";
import { isPlanEditable } from "@/lib/workflow";
import { planSlug } from "@/lib/plans";

export default async function TargetsPage({ searchParams }) {
  await requirePageAccess("/targets");
  const params = await searchParams;
  const planSlugParam = params?.plan;
  const periods = await getPlanningPeriods();

  if (!planSlugParam) {
    if (periods.length === 0) {
      return (
        <>
          <Header
            title="Target Creation"
            description="Set monthly targets by division, sales group, model, and sales office"
          />
          <DemandSupplyStepper currentStep="targets" plan={null} />
          <EmptyPlansGuide />
        </>
      );
    }
    redirect(`/targets?plan=${planSlug(periods[0].month, periods[0].year)}`);
  }

  const plan = await getActivePlan(planSlugParam);
  if (!plan) {
    redirect("/monthly-target-plans");
  }

  const supabase = await createClient();
  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("brand");

  const editable = isPlanEditable(plan.status);

  return (
    <>
      <Header
        title="Target Creation"
        description="Set monthly targets by division, sales group, model, and sales office"
      />
      <DemandSupplyStepper currentStep="targets" plan={plan} />
      {!editable && <PlanLockBanner />}
      <TargetEntryPanel
        plan={plan}
        targets={targets || []}
        periods={periods}
        editable={editable}
      />
    </>
  );
}
