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
  getModelsAcrossSalesGroups,
  rowKey,
} from "@/src/data";
import { getArticleCodesForModel } from "@/lib/constants";
import { planSlug } from "@/lib/plans";
import { Save, Send, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { CreatePlanModal } from "@/components/plan/create-plan-modal";

function articleExpandKey(divisionName, model) {
  return `${divisionName}::${model}`;
}

/** Model cell key scoped to a sales group column. */
function modelCellKey(salesGroupName, model) {
  return `${salesGroupName}::${model}`;
}

/** Article cell key scoped to a sales group column. */
function articleCellKey(salesGroupName, model, code) {
  return `${salesGroupName}::${rowKey(model, null, code)}`;
}

function parseUnits(raw) {
  if (raw === "" || raw === undefined || raw === null) return 0;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sum article units for one model × sales group. */
function articleSumForGroup(articleValues, salesGroupName, model, articleCodes) {
  return (articleCodes || []).reduce((sum, code) => {
    return sum + parseUnits(articleValues[articleCellKey(salesGroupName, model, code)]);
  }, 0);
}

/** True when any article has a value for this model × sales group. */
function hasArticleValuesForGroup(articleValues, salesGroupName, model, articleCodes) {
  return (articleCodes || []).some(
    (code) => parseUnits(articleValues[articleCellKey(salesGroupName, model, code)]) > 0
  );
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

/**
 * Demand & Supply / Approver grid:
 * Selected Brand × Month → Models as rows, Sales Groups as columns (+ optional Articles).
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

  const [divisionId, setDivisionId] = useState(() => divisions[0]?.id || "");
  const [expandedArticles, setExpandedArticles] = useState(() => new Set());
  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [articleValues, setArticleValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const salesGroupColumns = useMemo(
    () => (showAllGroups ? getSalesGroups() : getPrimarySalesGroups()),
    [showAllGroups]
  );
  const division = divisions.find((d) => d.id === divisionId) || divisions[0] || null;
  const models = useMemo(
    () => (division ? getModelsAcrossSalesGroups(division, salesGroupColumns) : []),
    [division, salesGroupColumns]
  );
  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const isLocked = readOnly || !editable;

  useEffect(() => {
    if (divisions.length === 0) return;
    if (!divisions.some((d) => d.id === divisionId)) {
      setDivisionId(divisions[0].id);
    }
  }, [divisions, divisionId]);

  useEffect(() => {
    if (!readOnly || targets.length === 0 || divisions.length === 0) return;
    const brand = targets[0].brand;
    const match = divisions.find((d) => d.name === brand);
    if (match) setDivisionId(match.id);
  }, [readOnly, targets, divisions]);

  // Hydrate model + article cells for the selected brand across sales group columns
  useEffect(() => {
    if (!division) return;

    const nextValues = {};
    const nextIds = {};
    const nextArticleValues = {};

    const modelAllocByTargetId = Object.fromEntries(
      modelAllocations.map((m) => [m.target_id, m])
    );

    for (const group of salesGroupColumns) {
      for (const model of models) {
        const key = modelCellKey(group.name, model);
        const existing = resolveModelTarget(targets, division.name, group.name, model);
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
            nextArticleValues[articleCellKey(group.name, model, art.article_code)] = String(
              art.units
            );
          }
        }

        // If articles exist for this model×group, model cell shows their sum
        const articleCodes = getArticleCodesForModel(division.name, model);
        if (
          hasArticleValuesForGroup(nextArticleValues, group.name, model, articleCodes)
        ) {
          const sum = articleSumForGroup(
            nextArticleValues,
            group.name,
            model,
            articleCodes
          );
          nextValues[key] = sum > 0 ? String(sum) : "";
        }
      }
    }

    setValues(nextValues);
    setRecordIds(nextIds);
    setArticleValues(nextArticleValues);

    // Auto-expand models that already have article breakdown
    const articleExpand = new Set();
    for (const model of models) {
      const codes = getArticleCodesForModel(division.name, model);
      const hasData = salesGroupColumns.some((group) =>
        hasArticleValuesForGroup(nextArticleValues, group.name, model, codes)
      );
      if (hasData) articleExpand.add(articleExpandKey(division.name, model));
    }
    if (readOnly || articleExpand.size > 0) {
      setExpandedArticles(articleExpand);
    }

    setError("");
    setMessage("");
  }, [
    division,
    salesGroupColumns,
    models,
    targets,
    modelAllocations,
    articleAllocations,
    readOnly,
  ]);

  const columnTotals = useMemo(() => {
    const totals = {};
    for (const group of salesGroupColumns) {
      totals[group.name] = models.reduce((sum, model) => {
        return sum + (parseInt(values[modelCellKey(group.name, model)], 10) || 0);
      }, 0);
    }
    return totals;
  }, [salesGroupColumns, models, values]);

  const grandTotal = useMemo(
    () => Object.values(columnTotals).reduce((sum, v) => sum + v, 0),
    [columnTotals]
  );

  function rowTotal(model) {
    return salesGroupColumns.reduce((sum, group) => {
      return sum + (parseInt(values[modelCellKey(group.name, model)], 10) || 0);
    }, 0);
  }

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/monthly-planning/${slug}?step=targets`);
    }
  }

  /** Edit model cell — clears article breakdown for that sales group (model becomes source). */
  function updateCell(salesGroupName, model, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    const key = modelCellKey(salesGroupName, model);
    const articles = getArticleCodesForModel(division.name, model);

    setArticleValues((prev) => {
      const next = { ...prev };
      for (const code of articles) {
        delete next[articleCellKey(salesGroupName, model, code)];
      }
      return next;
    });
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Edit article cell — model row auto-sums article totals for that sales group. */
  function updateArticleCell(salesGroupName, model, code, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    const aKey = articleCellKey(salesGroupName, model, code);
    const articles = getArticleCodesForModel(division.name, model);

    setArticleValues((prev) => {
      const next = { ...prev, [aKey]: value };
      const sum = articleSumForGroup(next, salesGroupName, model, articles);
      setValues((vPrev) => ({
        ...vPrev,
        [modelCellKey(salesGroupName, model)]: sum > 0 ? String(sum) : "",
      }));
      return next;
    });
  }

  function toggleArticles(model) {
    const k = articleExpandKey(division.name, model);
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  /** Collapse to model-level entry: keep model totals, drop article breakdown. */
  function setModelLevelOnly(model) {
    const articles = getArticleCodesForModel(division.name, model);
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      next.delete(articleExpandKey(division.name, model));
      return next;
    });
    setArticleValues((prev) => {
      const next = { ...prev };
      for (const group of salesGroupColumns) {
        for (const code of articles) {
          delete next[articleCellKey(group.name, model, code)];
        }
      }
      return next;
    });
  }

  async function handleSave(goToSubmit = false) {
    if (!division) {
      setError("Select a Division / Brand first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const targetPayload = [];
      const articlePayload = [];

      for (const group of salesGroupColumns) {
        for (const model of models) {
          const key = modelCellKey(group.name, model);
          const articles = getArticleCodesForModel(division.name, model);
          const usingArticles = hasArticleValuesForGroup(
            articleValues,
            group.name,
            model,
            articles
          );
          const units = usingArticles
            ? articleSumForGroup(articleValues, group.name, model, articles)
            : parseUnits(values[key]);

          if (!recordIds[key] && units === 0) continue;

          targetPayload.push({
            brand: division.name,
            sales_group: group.name,
            model,
            sales_office: null,
            target_units: units,
          });

          if (usingArticles) {
            for (const code of articles) {
              const aUnits = parseUnits(
                articleValues[articleCellKey(group.name, model, code)]
              );
              if (aUnits > 0) {
                articlePayload.push({
                  brand: division.name,
                  sales_group: group.name,
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
        const key = modelCellKey(row.sales_group, row.model);
        if (id) nextIds[key] = id;
        else if (row.target_units <= 0) delete nextIds[key];
      }
      setRecordIds(nextIds);

      if (goToSubmit) {
        const submitRes = await fetch("/api/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodId: plan.id,
            action: "submit_b2b",
            comment: "",
          }),
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) {
          throw new Error(submitData.error || "Plan saved, but submit for B2B review failed.");
        }
        setMessage(
          `Plan saved and submitted for B2B review (${saveData.targetCount || 0} model line${
            (saveData.targetCount || 0) === 1 ? "" : "s"
          }).`
        );
      } else {
        setMessage(
          `Draft saved (${saveData.targetCount || 0} model line${
            (saveData.targetCount || 0) === 1 ? "" : "s"
          }).`
        );
      }

      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  const canSubmitForReview = ["draft", "b2b_changes_requested", "md_changes_requested"].includes(
    plan.status
  );

  const hasGrid = division && models.length > 0;

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

        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs text-slate-500">Division / Brand</Label>
          <Select
            value={division?.id || ""}
            onChange={(e) => setDivisionId(e.target.value)}
            disabled={!readOnly && !editable}
            className="h-9"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAllGroups((v) => !v)}
            className="mb-1.5 text-[11px] text-slate-500 underline-offset-2 hover:underline"
          >
            {showAllGroups ? "Show primary sales groups" : "Show all sales groups"}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 pb-0.5">
          {editable && !readOnly && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={saving || !hasGrid}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save draft"}
              </Button>
              {canSubmitForReview && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={saving || !hasGrid}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {saving ? "Submitting..." : "Submit for B2B Review"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Select Month and Division/Brand, then enter targets under each Sales Group. Enter at model
        level, or expand articles — article entries automatically roll up to the model total.
        Sales office allocation is handled later by Retail Head.
      </p>

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {!hasGrid && (
        <p className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {divisions.length === 0
            ? "No divisions are available for your account."
            : "No models are configured for this brand and the selected sales groups."}
        </p>
      )}

      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-200/80">
                <th
                  rowSpan={3}
                  className="sticky left-0 z-20 min-w-[14rem] border border-slate-300 bg-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                >
                  Model
                </th>
                {salesGroupColumns.map((group) => (
                  <th
                    key={`hdr-${group.code}`}
                    className="min-w-[7.5rem] border border-slate-300 px-2 py-1.5 text-center text-xs font-semibold text-slate-800"
                  >
                    {group.name}
                  </th>
                ))}
                <th className="min-w-[6.5rem] border border-slate-300 bg-sky-100 px-2 py-1.5 text-center text-xs font-semibold text-slate-800">
                  Total
                </th>
              </tr>
              <tr className="bg-slate-100">
                {salesGroupColumns.map((group) => (
                  <th
                    key={`metric-${group.code}`}
                    className="border border-slate-300 px-2 py-1 text-center text-[11px] font-medium text-slate-600"
                  >
                    Target Qty
                  </th>
                ))}
                <th className="border border-slate-300 bg-sky-50 px-2 py-1 text-center text-[11px] font-medium text-slate-600">
                  Target Qty
                </th>
              </tr>
              <tr className="bg-slate-50">
                {salesGroupColumns.map((group) => (
                  <th
                    key={`uom-${group.code}`}
                    className="border border-slate-300 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500"
                  >
                    EA
                  </th>
                ))}
                <th className="border border-slate-300 bg-sky-50 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  EA
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((model, rowIndex) => {
                const articles = getArticleCodesForModel(division.name, model);
                const hasArticles = articles.length > 0;
                const showArticles = expandedArticles.has(
                  articleExpandKey(division.name, model)
                );
                const modelRowTotal = rowTotal(model);

                return (
                  <Fragment key={`model-${division.id}-${model}`}>
                    <tr
                      className={cn(rowIndex % 2 === 0 ? "bg-sky-50/50" : "bg-white")}
                    >
                      <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-2 py-1.5">
                        <div className="flex items-start gap-1.5">
                          {hasArticles ? (
                            <button
                              type="button"
                              onClick={() => toggleArticles(model)}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100"
                              aria-label={
                                showArticles ? `Collapse articles for ${model}` : `Expand articles for ${model}`
                              }
                            >
                              {showArticles ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="mt-0.5 inline-block w-4 shrink-0 text-center text-slate-400">
                              –
                            </span>
                          )}
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-medium text-slate-900">{model}</span>
                            {hasArticles && !readOnly && (
                              <select
                                className="h-6 max-w-[140px] rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-600"
                                value={showArticles ? "articles" : "model"}
                                onChange={(e) => {
                                  if (e.target.value === "articles") {
                                    setExpandedArticles((prev) => {
                                      const next = new Set(prev);
                                      next.add(articleExpandKey(division.name, model));
                                      return next;
                                    });
                                  } else {
                                    setModelLevelOnly(model);
                                  }
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
                        </div>
                      </td>
                      {salesGroupColumns.map((group) => {
                        const key = modelCellKey(group.name, model);
                        const articlesDrive = hasArticleValuesForGroup(
                          articleValues,
                          group.name,
                          model,
                          articles
                        );

                        return (
                          <td
                            key={`cell-${group.code}-${model}`}
                            className="border border-slate-200 p-0"
                          >
                            {isLocked || articlesDrive ? (
                              <div
                                className={cn(
                                  "flex h-8 items-center justify-center px-1 text-sm tabular-nums text-slate-900",
                                  articlesDrive && !isLocked && "bg-slate-50 text-slate-700"
                                )}
                                title={
                                  articlesDrive
                                    ? "Auto-total from article breakdown"
                                    : undefined
                                }
                              >
                                {values[key] || ""}
                              </div>
                            ) : (
                              <input
                                type="text"
                                inputMode="numeric"
                                className="h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50"
                                value={values[key] ?? ""}
                                onChange={(e) =>
                                  updateCell(group.name, model, e.target.value)
                                }
                                aria-label={`${division.name} ${model} / ${group.name}`}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-slate-200 bg-sky-50/60 px-2 py-1.5 text-center tabular-nums font-semibold text-slate-900">
                        {modelRowTotal > 0 ? modelRowTotal.toLocaleString() : ""}
                      </td>
                    </tr>

                    {showArticles &&
                      articles.map((code) => (
                        <tr
                          key={`art-${division.id}-${model}-${code}`}
                          className="bg-amber-50/40 text-xs"
                        >
                          <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-2 py-1 pl-8 font-mono text-[11px] text-amber-900">
                            <span className="mr-1.5 text-slate-400">–</span>
                            {code}
                          </td>
                          {salesGroupColumns.map((group) => {
                            const aKey = articleCellKey(group.name, model, code);

                            return (
                              <td
                                key={`art-cell-${group.code}-${model}-${code}`}
                                className="border border-slate-200 p-0"
                              >
                                {isLocked ? (
                                  <div className="flex h-7 items-center justify-center px-1 text-xs tabular-nums text-amber-900">
                                    {articleValues[aKey] || ""}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="h-7 w-full bg-transparent px-1 text-center text-xs tabular-nums outline-none focus:bg-amber-100"
                                    value={articleValues[aKey] ?? ""}
                                    onChange={(e) =>
                                      updateArticleCell(
                                        group.name,
                                        model,
                                        code,
                                        e.target.value
                                      )
                                    }
                                    aria-label={`${model} ${code} / ${group.name}`}
                                  />
                                )}
                              </td>
                            );
                          })}
                          <td className="border border-slate-200 bg-sky-50/40 px-2 py-1 text-center tabular-nums font-medium text-amber-900">
                            {salesGroupColumns.reduce((sum, group) => {
                              return (
                                sum +
                                parseUnits(
                                  articleValues[articleCellKey(group.name, model, code)]
                                )
                              );
                            }, 0) || ""}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              <tr className="bg-sky-100 font-semibold">
                <td className="sticky left-0 z-10 border border-slate-300 bg-sky-100 px-3 py-2 text-xs uppercase tracking-wide text-slate-700">
                  Total
                </td>
                {salesGroupColumns.map((group) => {
                  const colTotal = columnTotals[group.name] || 0;
                  return (
                    <td
                      key={`tot-${group.code}`}
                      className="border border-slate-300 px-2 py-2 text-center tabular-nums text-slate-900"
                    >
                      {colTotal > 0 ? colTotal.toLocaleString() : ""}
                    </td>
                  );
                })}
                <td className="border border-slate-300 bg-sky-200/70 px-2 py-2 text-center tabular-nums text-slate-900">
                  {grandTotal > 0 ? grandTotal.toLocaleString() : ""}
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
