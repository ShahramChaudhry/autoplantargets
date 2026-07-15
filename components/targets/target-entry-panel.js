"use client";

import { Fragment, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatPeriod } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getDivisionsForUser,
  getPrimarySalesGroups,
  getSalesGroups,
  getSalesGroupByCode,
  getSalesGroupByName,
  getModels,
  rowKey,
} from "@/src/data";
import { getArticleCodesForModel } from "@/lib/constants";
import { planSlug, planStepPath } from "@/lib/plans";
import { Save, Send, ChevronDown, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { CreatePlanModal } from "@/components/plan/create-plan-modal";

function articleKey(divisionName, model) {
  return `${divisionName}::${model}`;
}

/** Prefer brand+group+model with null office; fall back to summing legacy office rows. */
function resolveModelTarget(targets, brand, salesGroup, model) {
  const matches = (targets || []).filter(
    (t) => t.brand === brand && t.sales_group === salesGroup && t.model === model
  );
  if (matches.length === 0) return null;

  const direct = matches.find((t) => !t.sales_office);
  if (direct) return direct;

  const units = matches.reduce((sum, t) => sum + (t.target_units || 0), 0);
  return {
    id: null,
    brand,
    sales_group: salesGroup,
    model,
    sales_office: null,
    target_units: units,
    _aggregatedFromOffices: true,
  };
}

function computeArticleMismatches({
  divisions,
  salesGroup,
  expandedArticles,
  values,
  articleValues,
}) {
  if (!salesGroup) return [];
  const errors = [];

  for (const division of divisions) {
    const models = getModels(division, salesGroup);
    for (const model of models) {
      if (!expandedArticles.has(articleKey(division.name, model))) continue;

      const modelTotal = parseInt(values[rowKey(model)], 10) || 0;
      const articles = getArticleCodesForModel(division.name, model);
      let articleSum = 0;
      let hasArticleValue = false;

      for (const code of articles) {
        const units = parseInt(articleValues[rowKey(model, null, code)], 10) || 0;
        if (units > 0) hasArticleValue = true;
        articleSum += units;
      }

      if (hasArticleValue && articleSum !== modelTotal) {
        errors.push({
          division: division.name,
          model,
          modelTotal,
          articleSum,
          diff: articleSum - modelTotal,
        });
      }
    }
  }

  return errors;
}

/**
 * Demand & Supply / Approver grid:
 * Brand (division) → Models × selected Sales Group (+ optional Articles).
 * No sales office columns — that is NPM's allocation step.
 */
export function TargetEntryPanel({
  plan,
  targets,
  modelAllocations = [],
  articleAllocations = [],
  periods = [],
  editable = true,
  readOnly = false,
  user = null,
}) {
  const router = useRouter();
  const divisions = useMemo(() => getDivisionsForUser(user), [user]);

  const [salesGroupCode, setSalesGroupCode] = useState("001");
  const [expandedDivisions, setExpandedDivisions] = useState(
    () => new Set(divisions.map((d) => d.id))
  );
  const [expandedArticles, setExpandedArticles] = useState(() => new Set());
  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [articleValues, setArticleValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const salesGroupOptions = showAllGroups ? getSalesGroups() : getPrimarySalesGroups();
  const salesGroup = getSalesGroupByCode(salesGroupCode);
  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const isLocked = readOnly || !editable;

  useEffect(() => {
    if (!readOnly || targets.length === 0) return;
    const sg = getSalesGroupByName(targets[0].sales_group);
    if (sg) setSalesGroupCode(sg.code);
  }, [readOnly, targets]);

  useEffect(() => {
    if (salesGroupOptions.length === 0) return;
    if (!salesGroupOptions.some((g) => g.code === salesGroupCode)) {
      setSalesGroupCode(salesGroupOptions[0].code);
    }
  }, [salesGroupOptions, salesGroupCode]);

  // Hydrate model + article cells for the selected sales group
  useEffect(() => {
    if (!salesGroup) return;

    const nextValues = {};
    const nextIds = {};
    const nextArticleValues = {};

    const modelAllocByTargetId = Object.fromEntries(
      modelAllocations.map((m) => [m.target_id, m])
    );

    for (const division of divisions) {
      const models = getModels(division, salesGroup);
      for (const model of models) {
        const key = rowKey(model);
        const existing = resolveModelTarget(
          targets,
          division.name,
          salesGroup.name,
          model
        );
        nextValues[key] = existing ? String(existing.target_units) : "";
        if (existing?.id && !existing._aggregatedFromOffices) {
          nextIds[key] = existing.id;
        }

        const modelAlloc = existing?.id ? modelAllocByTargetId[existing.id] : null;
        if (modelAlloc) {
          const articles = articleAllocations.filter(
            (a) => a.model_allocation_id === modelAlloc.id
          );
          for (const art of articles) {
            nextArticleValues[rowKey(model, null, art.article_code)] = String(art.units);
          }
        }
      }
    }

    setValues(nextValues);
    setRecordIds(nextIds);
    setArticleValues(nextArticleValues);

    if (readOnly) {
      const articleExpand = new Set();
      for (const division of divisions) {
        const models = getModels(division, salesGroup);
        for (const model of models) {
          const codes = getArticleCodesForModel(division.name, model);
          const hasData = codes.some((code) => {
            const raw = nextArticleValues[rowKey(model, null, code)];
            return raw && parseInt(raw, 10) > 0;
          });
          if (hasData) articleExpand.add(articleKey(division.name, model));
        }
      }
      setExpandedArticles(articleExpand);
    }

    setError("");
    setMessage("");
  }, [
    divisions,
    salesGroup,
    targets,
    modelAllocations,
    articleAllocations,
    readOnly,
  ]);

  const articleMismatchErrors = useMemo(
    () =>
      computeArticleMismatches({
        divisions,
        salesGroup,
        expandedArticles,
        values,
        articleValues,
      }),
    [divisions, salesGroup, expandedArticles, values, articleValues]
  );

  const mismatchModels = useMemo(() => {
    const set = new Set();
    for (const e of articleMismatchErrors) {
      set.add(`${e.division}::${e.model}`);
    }
    return set;
  }, [articleMismatchErrors]);

  const total = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
    [values]
  );

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/monthly-planning/${slug}?step=targets`);
    }
  }

  function toggleDivision(id) {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateArticleCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setArticleValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(goToSubmit = false) {
    if (!salesGroup) {
      setError("Select a Sales Group first.");
      return;
    }

    if (articleMismatchErrors.length > 0) {
      setError(
        `Article totals must match model totals for ${articleMismatchErrors.length} model(s). Fix before saving.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const targetPayload = [];
      const articlePayload = [];

      for (const division of divisions) {
        const models = getModels(division, salesGroup);
        for (const model of models) {
          const key = rowKey(model);
          const raw = values[key];
          const units = raw === "" || raw === undefined ? 0 : parseInt(raw, 10);
          if (Number.isNaN(units) || units < 0) {
            throw new Error(`Invalid target for ${division.name} ${model}`);
          }
          if (!recordIds[key] && units === 0) continue;

          targetPayload.push({
            brand: division.name,
            sales_group: salesGroup.name,
            model,
            sales_office: null,
            target_units: units,
          });

          if (expandedArticles.has(articleKey(division.name, model))) {
            const articles = getArticleCodesForModel(division.name, model);
            for (const code of articles) {
              const aRaw = articleValues[rowKey(model, null, code)];
              const aUnits = aRaw === "" || aRaw === undefined ? 0 : parseInt(aRaw, 10);
              if (aUnits > 0) {
                articlePayload.push({
                  brand: division.name,
                  sales_group: salesGroup.name,
                  model,
                  sales_office: null,
                  articleCode: code,
                  units: aUnits,
                });
              }
            }
          }
        }
      }

      if (targetPayload.length === 0 || targetPayload.every((t) => !t.target_units)) {
        throw new Error("Enter at least one model target greater than 0 before saving.");
      }

      const saveRes = await fetch("/api/plans/save-grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: plan.id,
          targets: targetPayload,
          articles: articlePayload,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save plan");

      const nextIds = { ...recordIds };
      for (const row of targetPayload) {
        const cellKey = `${row.brand}::${row.sales_group}::${row.model}::`;
        const id = saveData.idByKey?.[cellKey];
        const key = rowKey(row.model);
        if (id) nextIds[key] = id;
        else if (row.target_units <= 0) delete nextIds[key];
      }
      setRecordIds(nextIds);

      setMessage(
        `Plan saved (${saveData.targetCount || 0} model line${
          (saveData.targetCount || 0) === 1 ? "" : "s"
        }).`
      );
      router.refresh();

      if (goToSubmit) {
        router.push(planStepPath("submit", plan.month, plan.year));
      }
    } catch (err) {
      setError(err.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  const hasGrid = salesGroup && divisions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-[160px] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-slate-500">Month</Label>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 underline-offset-2 hover:underline"
              >
                <Plus className="h-3 w-3" />
                New plan
              </button>
            )}
          </div>
          {readOnly ? (
            <p className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900">
              {formatPeriod(plan.month, plan.year)}
            </p>
          ) : (
            <Select
              value={planPath}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="h-9"
            >
              {monthOptions.map((p) => (
                <option key={p.id} value={planSlug(p.month, p.year)}>
                  {formatPeriod(p.month, p.year)}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="min-w-[220px] flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-slate-500">Sales Group</Label>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowAllGroups((v) => !v)}
                className="text-[11px] text-slate-500 underline-offset-2 hover:underline"
              >
                {showAllGroups ? "Show primary" : "Show all groups"}
              </button>
            )}
          </div>
          <Select
            value={salesGroupCode}
            onChange={(e) => setSalesGroupCode(e.target.value)}
            disabled={!readOnly && !editable}
            className="h-9"
          >
            {salesGroupOptions.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code} — {g.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2 pb-0.5">
          {editable && !readOnly && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={saving || !hasGrid || articleMismatchErrors.length > 0}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving || !hasGrid || articleMismatchErrors.length > 0}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save & Submit for Review"}
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Enter Brand → Model targets for the selected Sales Group. Models under a brand add up to
        that brand&apos;s total. If you break a model into articles, those articles must add up to
        the model total. Sales office allocation is handled later by Retail Head.
      </p>

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {articleMismatchErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                Article breakdown must match model totals before you can save
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {articleMismatchErrors.slice(0, 5).map((e) => (
                  <li key={`${e.division}-${e.model}`}>
                    {e.division} {e.model}: model {e.modelTotal} vs articles {e.articleSum} (
                    {e.diff > 0 ? "+" : ""}
                    {e.diff})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!hasGrid && (
        <p className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No divisions are available for your account.
        </p>
      )}

      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-rose-100/80">
                <th
                  colSpan={3}
                  className="sticky left-0 z-20 border border-slate-300 bg-rose-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-700"
                >
                  {formatPeriod(plan.month, plan.year)}
                </th>
                <th className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-700">
                  Units
                </th>
              </tr>
              <tr className="bg-rose-50">
                <th
                  colSpan={3}
                  className="sticky left-0 z-20 border border-slate-300 bg-rose-50 px-3 py-1.5 text-left text-xs font-medium text-slate-600"
                >
                  Sales Group
                </th>
                <th className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-800">
                  {salesGroup?.name}
                </th>
              </tr>
              <tr className="bg-slate-100">
                <th className="sticky left-0 z-20 w-9 border border-slate-300 bg-slate-100" />
                <th className="sticky left-9 z-20 border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-xs font-medium text-slate-600">
                  Code
                </th>
                <th className="sticky left-[7.5rem] z-20 border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-xs font-medium text-slate-600">
                  Model / Article
                </th>
                <th className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-xs font-medium text-slate-600">
                  Target
                </th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((division) => {
                const models = getModels(division, salesGroup);
                const isExpanded = expandedDivisions.has(division.id);
                const divisionTotal = models.reduce((sum, model) => {
                  return sum + (parseInt(values[rowKey(model)], 10) || 0);
                }, 0);

                return (
                  <Fragment key={division.id}>
                    <tr
                      className="cursor-pointer bg-slate-50 font-semibold hover:bg-slate-100"
                      onClick={() => toggleDivision(division.id)}
                    >
                      <td
                        colSpan={3}
                        className="sticky left-0 z-10 border border-slate-300 bg-inherit px-3 py-2 text-slate-900"
                      >
                        <span className="inline-flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {division.name}
                          <span className="text-xs font-normal text-slate-500">
                            ({models.length} models · {divisionTotal.toLocaleString()} units)
                          </span>
                        </span>
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center tabular-nums text-slate-700">
                        {divisionTotal > 0 ? divisionTotal : ""}
                      </td>
                    </tr>

                    {isExpanded &&
                      models.map((model, rowIndex) => {
                        const articles = getArticleCodesForModel(division.name, model);
                        const hasArticles = articles.length > 0;
                        const showArticles = expandedArticles.has(
                          articleKey(division.name, model)
                        );
                        const key = rowKey(model);
                        const mismatched = mismatchModels.has(`${division.name}::${model}`);

                        return (
                          <Fragment key={`model-${division.id}-${model}`}>
                            <tr
                              className={cn(
                                rowIndex % 2 === 0 ? "bg-sky-50/40" : "bg-white",
                                mismatched && "bg-red-50/80"
                              )}
                            >
                              <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-1 py-1 text-center">
                                {hasArticles && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const k = articleKey(division.name, model);
                                      setExpandedArticles((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(k)) next.delete(k);
                                        else next.add(k);
                                        return next;
                                      });
                                    }}
                                    className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                                  >
                                    {showArticles ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="sticky left-9 z-10 border border-slate-200 bg-inherit px-2 py-1.5 font-mono text-xs text-slate-600">
                                {model}
                              </td>
                              <td className="sticky left-[7.5rem] z-10 border border-slate-200 bg-inherit px-2 py-1.5">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-slate-900">{model}</span>
                                  {hasArticles && !readOnly && (
                                    <select
                                      className="h-6 max-w-[130px] rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-600"
                                      value={showArticles ? "articles" : "model"}
                                      onChange={(e) => {
                                        const k = articleKey(division.name, model);
                                        setExpandedArticles((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.value === "articles") next.add(k);
                                          else next.delete(k);
                                          return next;
                                        });
                                      }}
                                      disabled={!editable}
                                    >
                                      <option value="model">Model level</option>
                                      <option value="articles">+ Articles (optional)</option>
                                    </select>
                                  )}
                                  {hasArticles && readOnly && showArticles && (
                                    <span className="text-[10px] text-amber-700">+ Articles</span>
                                  )}
                                </div>
                              </td>
                              <td className="border border-slate-200 p-0">
                                {isLocked ? (
                                  <div className="flex h-8 items-center justify-center px-1 text-sm tabular-nums text-slate-900">
                                    {values[key] || ""}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className={cn(
                                      "h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50",
                                      mismatched && "bg-red-100 ring-1 ring-inset ring-red-300"
                                    )}
                                    value={values[key] ?? ""}
                                    onChange={(e) => updateCell(key, e.target.value)}
                                    aria-label={`${division.name} ${model} / ${salesGroup.name}`}
                                  />
                                )}
                              </td>
                            </tr>

                            {showArticles &&
                              articles.map((code) => {
                                const aKey = rowKey(model, null, code);
                                return (
                                  <tr
                                    key={`art-${division.id}-${model}-${code}`}
                                    className="bg-amber-50/30 text-xs"
                                  >
                                    <td className="sticky left-0 z-10 border border-slate-200 bg-inherit" />
                                    <td className="sticky left-9 z-10 border border-slate-200 bg-inherit px-2 py-1 text-slate-400">
                                      ↳
                                    </td>
                                    <td className="sticky left-[7.5rem] z-10 border border-slate-200 bg-inherit px-2 py-1 font-mono text-[11px] text-amber-900">
                                      {code}
                                    </td>
                                    <td className="border border-slate-200 p-0">
                                      {isLocked ? (
                                        <div className="flex h-7 items-center justify-center px-1 text-xs tabular-nums text-amber-900">
                                          {articleValues[aKey] || ""}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          className={cn(
                                            "h-7 w-full bg-transparent px-1 text-center text-xs tabular-nums outline-none focus:bg-amber-100",
                                            mismatched &&
                                              "bg-red-100 ring-1 ring-inset ring-red-300"
                                          )}
                                          value={articleValues[aKey] ?? ""}
                                          onChange={(e) =>
                                            updateArticleCell(aKey, e.target.value)
                                          }
                                          aria-label={`${model} ${code}`}
                                        />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
              <tr className="bg-slate-100 font-semibold">
                <td
                  colSpan={3}
                  className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-3 py-2 text-xs uppercase tracking-wide text-slate-600"
                >
                  Total · {salesGroup?.name}
                </td>
                <td className="border border-slate-300 px-2 py-2 text-center tabular-nums">
                  {total > 0 ? total.toLocaleString() : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && (
        <CreatePlanModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}
