import { WORKFLOW_PIPELINE } from "@/lib/constants";
import { WorkflowPipeline } from "@/components/workflow/workflow-pipeline";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";

export function WorkflowStatus({ status }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Current stage:</span>
        <Badge variant={getStatusBadgeVariant(status)}>
          {STATUS_LABELS[status] || status}
        </Badge>
      </div>
      <WorkflowPipeline status={status} />
    </div>
  );
}

export { WORKFLOW_PIPELINE };
