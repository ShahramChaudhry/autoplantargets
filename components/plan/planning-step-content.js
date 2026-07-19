import Link from "next/link";
import { TargetEntryPanel } from "@/components/targets/target-entry-panel";
import { PlanLockBanner } from "@/components/plan/plan-lock-banner";
import { EmptyPlansGuide } from "@/components/plan/workflow-guide";
import { FinalizePlanAction } from "@/components/workflow/finalize-plan-action";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isPlanEditable } from "@/lib/workflow";
import { planLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export async function PlanningStepContent({ step, plan, periods, user }) {
  if (!plan) {
    return <EmptyPlansGuide />;
  }

  // All D&S work (including submit) happens on the planning grid
  if (
    step === "targets" ||
    step === "models" ||
    step === "articles" ||
    step === "plan" ||
    step === "review" ||
    step === "submit"
  ) {
    return <TargetsStep plan={plan} periods={periods} user={user} />;
  }

  return <EmptyPlansGuide />;
}

async function TargetsStep({ plan, periods, user }) {
  const supabase = await createClient();
  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", plan.id)
    .order("brand");

  const targetIds = (targets || []).map((t) => t.id);
  let modelAllocations = [];
  let articleAllocations = [];

  if (targetIds.length) {
    const { data: modelRows } = await supabase
      .from("model_allocations")
      .select("*")
      .in("target_id", targetIds);
    modelAllocations = modelRows || [];

    const modelIds = modelAllocations.map((m) => m.id);
    if (modelIds.length) {
      const { data: articleRows } = await supabase
        .from("article_allocations")
        .select("*")
        .in("model_allocation_id", modelIds);
      articleAllocations = articleRows || [];
    }
  }

  const editable = isPlanEditable(plan.status);

  return (
    <>
      {!editable && <PlanLockBanner />}
      {plan.status === "md_approved" && (
        <div className="mb-4">
          <FinalizePlanAction
            periodId={plan.id}
            planName={planLabel(plan.month, plan.year)}
            status={plan.status}
          />
        </div>
      )}
      <TargetEntryPanel
        plan={plan}
        targets={targets || []}
        modelAllocations={modelAllocations}
        articleAllocations={articleAllocations}
        periods={periods}
        editable={editable}
        user={user}
      />
    </>
  );
}

export function PlanningEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
      <p className="text-slate-600">Create a monthly target plan to start planning.</p>
      <Link href="/monthly-planning" className={cn(buttonVariants(), "mt-4 gap-2")}>
        <Plus className="h-4 w-4" />
        Create Monthly Target Plan
      </Link>
    </div>
  );
}
