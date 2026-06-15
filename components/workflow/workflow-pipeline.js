import { WORKFLOW_PIPELINE } from "@/lib/constants";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function stageIndex(status) {
  const map = {
    draft: 0,
    submitted_b2b: 1,
    b2b_changes_requested: 1,
    b2b_approved: 2,
    submitted_md: 2,
    md_changes_requested: 2,
    md_approved: 2,
    finalized: 3,
    retail_allocation: 4,
    executive_allocation: 5,
    reconciliation_failed: 6,
    completed: 7,
  };
  return map[status] ?? 0;
}

export function WorkflowPipeline({ status }) {
  const current = stageIndex(status);
  const isComplete = status === "completed";

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-1">
        {WORKFLOW_PIPELINE.map((step, index) => {
          const done = index < current || isComplete;
          const active = index === current && !isComplete;
          const failed = status === "reconciliation_failed" && step.key === "reconciliation";

          return (
            <div key={step.key} className="flex items-center">
              <div
                className={cn(
                  "flex min-w-[7.5rem] flex-col items-center rounded-lg border px-3 py-2 text-center",
                  done && "border-emerald-200 bg-emerald-50",
                  active && !failed && "border-slate-900 bg-slate-900 text-white shadow-md",
                  failed && "border-red-300 bg-red-50",
                  !done && !active && !failed && "border-slate-200 bg-white text-slate-400"
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    done && "bg-emerald-600 text-white",
                    active && !failed && "bg-white text-slate-900",
                    failed && "bg-red-600 text-white",
                    !done && !active && !failed && "bg-slate-100 text-slate-400"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span className={cn("text-xs font-medium leading-tight", active && !failed && "text-white")}>
                  {step.label}
                </span>
              </div>
              {index < WORKFLOW_PIPELINE.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 w-4",
                    index < current || isComplete ? "bg-emerald-400" : "bg-slate-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
