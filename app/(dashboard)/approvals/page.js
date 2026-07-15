import { Header } from "@/components/layout/header";
import { ApprovalReview } from "@/components/approvals/approval-review";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { getQueuePlan, getPlanningPeriods } from "@/lib/data";
import { isAwaitingB2BReview, isAwaitingMDApproval } from "@/lib/workflow";
import { ROLES } from "@/lib/constants";

async function loadPlanAllocations(supabase, planId) {
  const { data: targets } = await supabase
    .from("targets")
    .select("*")
    .eq("planning_period_id", planId)
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

  return { targets: targets || [], modelAllocations, articleAllocations };
}

export default async function ApprovalsPage({ searchParams }) {
  const user = await requirePageAccess("/approvals");
  const params = await searchParams;
  const isB2B = user.role === ROLES.B2B_DIRECTOR;
  const isMD = user.role === ROLES.MANAGING_DIRECTOR;

  const periods = await getPlanningPeriods();
  const pendingPlans = periods.filter((p) =>
    isB2B ? isAwaitingB2BReview(p.status) : isAwaitingMDApproval(p.status)
  );

  const plan = await getQueuePlan(user.role, params?.plan);
  const supabase = await createClient();

  const allocationData = plan
    ? await loadPlanAllocations(supabase, plan.id)
    : { targets: [], modelAllocations: [], articleAllocations: [] };

  let reviewNotes = [];
  if (isMD && plan) {
    const { data } = await supabase
      .from("audit_logs")
      .select("*, users(name)")
      .eq("planning_period_id", plan.id)
      .in("action", ["b2b_approve", "b2b_request_changes"])
      .order("created_at", { ascending: false })
      .limit(5);
    reviewNotes = data || [];
  }

  const awaitingReview = plan
    ? isB2B
      ? isAwaitingB2BReview(plan.status)
      : isAwaitingMDApproval(plan.status)
    : false;

  return (
    <>
      <Header
        title="Approvals"
        description={
          isMD
            ? "Review plans approved by B2B, inspect the planning grid, and give final approval"
            : "Review submitted monthly target plans, inspect the planning grid, and approve or request changes"
        }
      />
      <ApprovalReview
        plan={plan}
        periods={periods}
        targets={allocationData.targets}
        modelAllocations={allocationData.modelAllocations}
        articleAllocations={allocationData.articleAllocations}
        pendingPlans={pendingPlans}
        awaitingReview={awaitingReview}
        user={user}
        variant={isMD ? "md" : "b2b"}
        reviewNotes={reviewNotes}
      />
    </>
  );
}
