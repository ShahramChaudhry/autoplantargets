"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { planStepPath } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { ArrowRight, SkipForward } from "lucide-react";

export function SkipArticleAllocationAction({ plan, editable }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!plan || !editable) return null;

  async function handleSkip() {
    setLoading(true);
    try {
      const res = await fetch("/api/plans/article-skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: plan.id, skipped: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to skip article allocation");
        return;
      }
      router.push(planStepPath("review", plan.month, plan.year));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-900">Article Allocation is optional</p>
        <p className="mt-1 text-sm text-slate-600">
          You can skip this step and continue to Review. You may return later to complete it before
          final submission.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2" onClick={handleSkip} disabled={loading}>
          <SkipForward className="h-4 w-4" />
          {loading ? "Skipping..." : "Skip Article Allocation"}
        </Button>
      </div>
    </div>
  );
}

export function ContinueAfterArticlesActions({ plan, hasArticles, skipped }) {
  if (!plan) return null;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        {skipped ? (
          <p className="text-sm text-amber-700">Article Allocation is marked as skipped.</p>
        ) : hasArticles ? (
          <p className="text-sm text-emerald-700">Article Allocation is complete. You can continue.</p>
        ) : (
          <p className="text-sm text-slate-600">
            Add article lines, or skip this optional step to continue.
          </p>
        )}
      </div>
      {(hasArticles || skipped) && (
        <Link href={planStepPath("review", plan.month, plan.year)} className={cn(buttonVariants(), "gap-2")}>
          Continue to Review
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
