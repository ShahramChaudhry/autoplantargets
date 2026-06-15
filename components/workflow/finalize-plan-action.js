"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Lock } from "lucide-react";

export function FinalizePlanAction({ periodId, planName, status }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (status !== "md_approved") {
    return null;
  }

  async function handleFinalize() {
    if (
      !confirm(
        `Finalize ${planName}? This will lock all targets and allocations and release the plan for Sales Office Allocation.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, action: "finalize" }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to finalize plan");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h3 className="font-semibold text-slate-900">Ready to Finalize</h3>
            <p className="mt-1 text-sm text-slate-600">
              Managing Director has approved <strong>{planName}</strong>. Finalize the plan to lock
              all targets and allocations, then release it for Sales Office Allocation.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              After finalization, Demand &amp; Supply editing will be locked.
            </p>
          </div>
        </div>
        <Button onClick={handleFinalize} disabled={loading} className="shrink-0 gap-2">
          {loading ? "Finalizing..." : "Finalize Plan"}
        </Button>
      </CardContent>
    </Card>
  );
}
