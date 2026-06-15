"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const DISABLED_TOOLTIP = "All retail target units must be allocated before completion.";

export function CompleteRetailAllocationAction({
  periodId,
  planName,
  retailTarget,
  allocated,
  status,
  canComplete,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  const isLocked = status !== "finalized";
  const isDisabled = !canComplete || loading;

  if (isLocked) {
    return null;
  }

  async function handleComplete() {
    setLoading(true);
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, action: "start_retail" }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to complete retail allocation");
        return;
      }

      setModalOpen(false);
      setSuccessMessage(data.message || "Retail allocation completed successfully.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {successMessage && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Complete Sales Office Allocation</h3>
            <p className="mt-1 text-sm text-slate-600">
              Mark retail allocation complete once all {retailTarget.toLocaleString()} units are assigned to
              sales offices.
            </p>
          </div>
          <span
            title={isDisabled ? DISABLED_TOOLTIP : undefined}
            className="inline-flex shrink-0"
          >
            <Button disabled={isDisabled} onClick={() => setModalOpen(true)}>
              Mark Retail Allocation Complete
            </Button>
          </span>
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-retail-title"
          >
            <h2 id="complete-retail-title" className="text-lg font-semibold text-slate-900">
              Confirm Retail Allocation Completion?
            </h2>
            <div className="mt-4 space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-medium">Retail Target:</span> {retailTarget.toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Allocated:</span> {allocated.toLocaleString()}
              </p>
            </div>
            <p className="mt-4 text-sm text-slate-600">This action will:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
              <li>Lock Sales Office Allocations</li>
              <li>Notify Branch Managers</li>
              <li>Enable Executive Allocation</li>
            </ul>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleComplete} disabled={loading}>
                {loading ? "Completing..." : "Complete Allocation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
