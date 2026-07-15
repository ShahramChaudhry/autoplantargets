"use client";

import Link from "next/link";
import { ArticleAllocationForm } from "@/components/allocations/article-allocation-form";
import { InlineUnitsEditor } from "@/components/allocations/inline-units-editor";
import { DeleteAllocationButton } from "@/components/allocations/delete-allocation-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { planStepPath } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { ArrowRight, AlertCircle } from "lucide-react";

function ModelArticleSection({ plan, brand, model, articles, editable }) {
  const items = articles.filter((a) => a.model_allocation_id === model.id);
  const allocated = items.reduce((sum, a) => sum + a.units, 0);
  const remaining = model.units - allocated;
  const isBalanced = remaining === 0;
  const isOver = remaining < 0;

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3">
        <h4 className="font-medium text-slate-900">
          {model.model}{" "}
          <span className="font-normal text-slate-500">({model.units.toLocaleString()} Units)</span>
        </h4>
      </div>

      <div className="px-4 py-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No article allocations yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto] gap-4 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span>Article Code</span>
              <span className="text-right">Units</span>
            </div>
            {items.map((article) => (
              <div
                key={article.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
              >
                <p className="font-medium text-slate-900">{article.article_code}</p>
                <div className="flex items-center justify-end gap-1">
                  <InlineUnitsEditor
                    type="articles"
                    recordId={article.id}
                    field="units"
                    value={article.units}
                    periodId={plan.id}
                    max={article.units + remaining}
                    disabled={!editable}
                  />
                  {editable && (
                    <DeleteAllocationButton
                      type="articles"
                      id={article.id}
                      periodId={plan.id}
                      label={`Delete ${article.article_code}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isOver && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Over-allocated by {Math.abs(remaining)} units. Reduce article allocations to match the model total.
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="text-slate-600">
            Allocated:{" "}
            <span
              className={cn(
                "font-semibold",
                isBalanced ? "text-emerald-600" : isOver ? "text-red-600" : "text-slate-900"
              )}
            >
              {allocated.toLocaleString()} / {model.units.toLocaleString()}
            </span>
          </span>
          <span
            className={cn(
              "font-medium",
              isBalanced ? "text-emerald-600" : isOver ? "text-red-600" : "text-amber-600"
            )}
          >
            Remaining: {remaining.toLocaleString()}
          </span>
        </div>

        <div className="mt-4">
          <ArticleAllocationForm
            plan={plan}
            brand={brand}
            modelAllocation={model}
            articles={articles}
            editable={editable}
          />
        </div>
      </div>
    </div>
  );
}

export function ArticleAllocationGroups({ plan, targets, models, articles, editable = true }) {
  const groups = targets
    .map((target) => ({
      target,
      models: models.filter((m) => m.target_id === target.id),
    }))
    .filter((g) => g.models.length > 0);

  const modelStats = models.map((model) => {
    const items = articles.filter((a) => a.model_allocation_id === model.id);
    const allocated = items.reduce((sum, a) => sum + a.units, 0);
    return { remaining: model.units - allocated };
  });

  const allBalanced = modelStats.length > 0 && modelStats.every((s) => s.remaining === 0);
  const hasOverAllocation = modelStats.some((s) => s.remaining < 0);

  return (
    <div className="space-y-6">
      {groups.map(({ target, models: targetModels }) => (
        <Card key={target.id}>
          <CardHeader>
            <CardTitle>
              {target.brand} {target.sales_group}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {targetModels.map((model) => (
              <ModelArticleSection
                key={model.id}
                plan={plan}
                brand={target.brand}
                model={model}
                articles={articles}
                editable={editable}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {models.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            {!allBalanced && (
              <p className="text-sm text-amber-700">
                {hasOverAllocation
                  ? "Fix over-allocations before continuing."
                  : "All model groups must have zero remaining units before continuing."}
              </p>
            )}
            {allBalanced && (
              <p className="text-sm text-emerald-700">All article allocations are balanced. You can continue.</p>
            )}
          </div>
          {allBalanced ? (
            <Link
              href={planStepPath("review", plan.month, plan.year)}
              className={cn(buttonVariants(), "gap-2")}
            >
              Continue to Review
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span
              className={cn(buttonVariants(), "pointer-events-none gap-2 opacity-50")}
              aria-disabled
            >
              Continue to Review
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
