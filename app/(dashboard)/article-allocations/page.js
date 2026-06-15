import { Header } from "@/components/layout/header";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { ArticleAllocationsWorkspace } from "@/components/allocations/article-allocations-workspace";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan, getPlanningPeriods } from "@/lib/data";

export default async function ArticleAllocationsPage({ searchParams }) {
  await requirePageAccess("/article-allocations");
  const params = await searchParams;
  const plans = await getPlanningPeriods();
  const plan = params?.plan ? await getActivePlan(params.plan) : plans[0] || null;

  let targets = [];
  let models = [];
  let articles = [];

  if (plan) {
    const supabase = await createClient();
    const { data: targetRows } = await supabase
      .from("targets")
      .select("*")
      .eq("planning_period_id", plan.id)
      .order("brand");

    targets = targetRows || [];
    const targetIds = targets.map((t) => t.id);

    if (targetIds.length) {
      const { data: modelRows } = await supabase
        .from("model_allocations")
        .select("*")
        .in("target_id", targetIds)
        .order("model");
      models = modelRows || [];
    }

    const modelIds = models.map((m) => m.id);
    if (modelIds.length) {
      const { data: articleRows } = await supabase
        .from("article_allocations")
        .select("*")
        .in("model_allocation_id", modelIds);
      articles = articleRows || [];
    }
  }

  return (
    <>
      <Header title="Article Allocation" description="Break down model targets by article code" />
      <DemandSupplyStepper currentStep="articles" plan={plan} />
      <ArticleAllocationsWorkspace
        plans={plans}
        plan={plan}
        targets={targets}
        models={models}
        articles={articles}
      />
    </>
  );
}
