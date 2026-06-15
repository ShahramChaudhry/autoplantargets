import { AlertCircle } from "lucide-react";
import { PLAN_LOCK_MESSAGE } from "@/lib/plan-editability";

export function PlanLockBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p>{PLAN_LOCK_MESSAGE}</p>
    </div>
  );
}
