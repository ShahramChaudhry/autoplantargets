import { Lock } from "lucide-react";
import { RETAIL_ALLOCATION_LOCK_MESSAGE } from "@/lib/retail-allocation";

export function RetailAllocationLockBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
      <p>{RETAIL_ALLOCATION_LOCK_MESSAGE}</p>
    </div>
  );
}
