import { Card, CardContent } from "@/components/ui/card";
import { getRetailAllocationProgress } from "@/lib/retail-allocation";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function RetailAllocationProgress({ retailTarget, allocated, isComplete = false }) {
  const progress = getRetailAllocationProgress(retailTarget, allocated);
  const showComplete = isComplete || progress.isFullyAllocated;

  return (
    <Card className="border-slate-200">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Retail Target</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {progress.retailTarget.toLocaleString()} <span className="text-base font-semibold">Units</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Allocated to Offices</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              showComplete ? "text-emerald-700" : progress.isOverAllocated ? "text-red-700" : "text-amber-700"
            )}
          >
            {progress.allocated.toLocaleString()} <span className="text-base font-semibold">Units</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              showComplete ? "text-emerald-700" : progress.remaining > 0 ? "text-amber-700" : "text-red-700"
            )}
          >
            {showComplete ? 0 : Math.abs(progress.remaining).toLocaleString()}{" "}
            <span className="text-base font-semibold">Units</span>
          </p>
          {progress.isOverAllocated && !showComplete && (
            <p className="mt-1 text-xs text-red-600">Over-allocated</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
          <div className="mt-2 flex items-center gap-2">
            {showComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-emerald-700">Fully Allocated</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-amber-700">Incomplete</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
