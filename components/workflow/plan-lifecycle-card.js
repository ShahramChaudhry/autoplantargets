import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { WorkflowStatus } from "@/components/workflow-status";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Shared plan lifecycle timeline — visible to every role working a monthly plan.
 */
export function PlanLifecycleCard({ plan, className, titleSuffix = "Plan status" }) {
  if (!plan) return null;

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            {planLabel(plan.month, plan.year)} — {titleSuffix}
          </CardTitle>
          <Badge variant={getStatusBadgeVariant(plan.status)}>
            {STATUS_LABELS[plan.status] || plan.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <WorkflowStatus status={plan.status} />
      </CardContent>
    </Card>
  );
}
