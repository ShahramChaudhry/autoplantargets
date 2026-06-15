import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { WorkflowPipeline } from "@/components/workflow/workflow-pipeline";
import { WorkflowActions } from "@/components/workflow-actions";
import { FinalizePlanAction } from "@/components/workflow/finalize-plan-action";
import { EmptyPlansGuide } from "@/components/plan/workflow-guide";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel } from "@/lib/plans";

export default async function WorkflowStatusPage({ searchParams }) {
  const user = await requirePageAccess("/workflow-status");
  const params = await searchParams;

  if (!params?.plan) {
    return (
      <>
        <Header
          title="Review & Submit"
          description="Review your plan and submit for B2B and MD approval"
        />
        <DemandSupplyStepper currentStep="review" plan={null} />
        <EmptyPlansGuide />
      </>
    );
  }

  const plan = await getActivePlan(params.plan);
  if (!plan) redirect("/monthly-target-plans");

  return (
    <>
      <Header
        title="Review & Submit"
        description="Review your plan and submit for B2B and MD approval"
      />
      <DemandSupplyStepper currentStep="review" plan={plan} />

      <FinalizePlanAction
        periodId={plan.id}
        planName={planLabel(plan.month, plan.year)}
        status={plan.status}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{planLabel(plan.month, plan.year)} — Ready to submit?</CardTitle>
            <Badge variant={getStatusBadgeVariant(plan.status)}>
              {STATUS_LABELS[plan.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <WorkflowPipeline status={plan.status} />
          <p className="text-sm text-slate-600">
            When your targets and allocations are complete, submit this monthly target plan for review.
            After B2B approval, the plan is automatically forwarded to the Managing Director. Once MD
            approves, finalize the plan to release it for retail allocation.
          </p>
          <WorkflowActions periodId={plan.id} status={plan.status} role={user.role} />
        </CardContent>
      </Card>
    </>
  );
}
