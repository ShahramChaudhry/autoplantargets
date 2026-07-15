"use client";

import Link from "next/link";
import { DEMAND_SUPPLY_WORKFLOW_STEPS } from "@/lib/constants";
import { planStepPath, isArticleAllocationSkipped } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

export function DemandSupplyStepper({ currentStep, plan }) {
  const currentIndex = DEMAND_SUPPLY_WORKFLOW_STEPS.findIndex((s) => s.key === currentStep);
  const articlesSkipped = isArticleAllocationSkipped(plan);

  return (
    <nav aria-label="Planning workflow" className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="flex min-w-max items-center gap-2">
        {DEMAND_SUPPLY_WORKFLOW_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const skipped = step.key === "articles" && articlesSkipped && !active;
          const href = plan ? planStepPath(step.key, plan.month, plan.year) : "/monthly-planning";
          const disabled = step.key !== "plan" && !plan;

          const content = (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active && "bg-slate-900 text-white",
                skipped && !active && "bg-amber-50 text-amber-800",
                done && !active && !skipped && "bg-emerald-50 text-emerald-800",
                !done && !active && !disabled && !skipped && "text-slate-600 hover:bg-slate-50",
                disabled && "cursor-not-allowed text-slate-300"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  active && "bg-white text-slate-900",
                  skipped && !active && "bg-amber-500 text-white",
                  done && !active && !skipped && "bg-emerald-600 text-white",
                  !done && !active && !skipped && "bg-slate-100 text-slate-500"
                )}
              >
                {skipped ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex flex-col">
                <span>{step.label}</span>
                {step.optional && (
                  <span className={cn("text-[10px] font-normal", active ? "text-slate-300" : "text-slate-400")}>
                    {skipped ? "Skipped" : "Optional"}
                  </span>
                )}
              </span>
            </div>
          );

          return (
            <li key={step.key} className="flex items-center">
              {disabled ? content : <Link href={href}>{content}</Link>}
              {index < DEMAND_SUPPLY_WORKFLOW_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px w-6",
                    done || skipped ? "bg-emerald-300" : "bg-slate-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
