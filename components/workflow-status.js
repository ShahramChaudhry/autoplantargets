import { STATUS_LABELS } from "@/lib/constants";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowStatus({ status }) {
  const displaySteps = [
    { key: "draft", label: "Create Targets" },
    { key: "submitted_b2b", label: "B2B Review" },
    { key: "submitted_md", label: "MD Review" },
    { key: "finalized", label: "Finalize" },
    { key: "retail_allocation", label: "Sales Offices" },
    { key: "executive_allocation", label: "Executives" },
    { key: "completed", label: "Completed" },
  ];

  const stepIndex = (key) => {
    const map = {
      draft: 0,
      submitted_b2b: 1,
      b2b_changes_requested: 1,
      b2b_approved: 1,
      submitted_md: 2,
      md_changes_requested: 2,
      md_approved: 2,
      finalized: 3,
      retail_allocation: 4,
      executive_allocation: 5,
      reconciliation_failed: 5,
      completed: 6,
    };
    return map[key] ?? 0;
  };

  const current = stepIndex(status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Current Status:</span>
        <Badge variant={getStatusBadgeVariant(status)}>
          {STATUS_LABELS[status] || status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {displaySteps.map((step, index) => {
          const done = index < current || status === "completed";
          const active = index === current && status !== "completed";

          return (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                  done && "bg-emerald-600 text-white",
                  active && "bg-slate-900 text-white ring-4 ring-slate-200",
                  !done && !active && "bg-slate-100 text-slate-400"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-slate-900" : "text-slate-500"
                )}
              >
                {step.label}
              </span>
              {index < displaySteps.length - 1 && (
                <div className={cn("mx-1 h-px w-6", done ? "bg-emerald-300" : "bg-slate-200")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
