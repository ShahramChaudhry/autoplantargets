"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Scale } from "lucide-react";

export function ReconciliationPanel({ periodId, initialResult }) {
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function runReconciliation() {
    setLoading(true);
    try {
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Reconciliation failed");
        return;
      }

      setResult(data);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Reconciliation Rule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            SUM(Model Targets for Retail) must equal SUM(Sales Office Targets), and
            SUM(Sales Office Targets) must equal SUM(Executive Allocations).
          </p>
          <Button className="mt-4" onClick={runReconciliation} disabled={loading}>
            {loading ? "Running..." : "Run Reconciliation"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Model Targets (Retail)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{result.modelSum}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Sales Office Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{result.officeSum}</div>
              <p className={`mt-1 text-xs ${result.modelOfficeMatch ? "text-emerald-600" : "text-red-600"}`}>
                {result.modelOfficeMatch ? "Matches models" : `Variance: ${result.variance}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Executive Allocations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{result.executiveSum}</div>
              <p className={`mt-1 text-xs ${result.officeExecutiveMatch ? "text-emerald-600" : "text-red-600"}`}>
                {result.officeExecutiveMatch ? "Matches offices" : `Variance: ${result.executiveVariance}`}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {result && (
        <Card className={result.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}>
          <CardContent className="flex items-center gap-3 py-6">
            {result.passed ? (
              <>
                <CheckCircle className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Reconciliation Passed</p>
                  <p className="text-sm text-emerald-700">Process marked as Completed.</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Reconciliation Failed</p>
                  <p className="text-sm text-red-700">
                    Branch Manager has been notified. Update allocations and re-run reconciliation.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
