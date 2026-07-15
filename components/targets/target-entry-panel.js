"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatPeriod } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getDivisionsForUser,
  getPrimarySalesGroups,
  getSalesGroups,
  getUnionOfficesForUser,
  getSalesGroupByCode,
  getSalesGroupByName,
  getModels,
  getOfficeName,
  getOfficeLabel,
  rowKey,
} from "@/src/data";
import { getArticleCodesForModel } from "@/lib/constants";
import { planSlug, planStepPath } from "@/lib/plans";
import { Save, Send, ChevronDown, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { CreatePlanModal } from "@/components/plan/create-plan-modal";

function findExistingTarget(targets, brand, salesGroup, model, salesOffice) {
  const officeName = getOfficeName(salesOffice);
  return targets.find(
    (t) =>
      t.brand === brand &&
      t.sales_group === salesGroup &&
      t.model === model &&
      (t.sales_office === officeName || (!t.sales_office && !officeName))
  );
}

function articleKey(divisionName, model) {
  return `${divisionName}::${model}`;
}

function computeArticleMismatches({
  divisions,
  salesGroup,
  expandedArticles,
  values,
  articleValues,
  officesForDivision,
}) {
  if (!salesGroup) return [];

  const errors = [];

  for (const division of divisions) {
    const models = getModels(division, salesGroup);
    const divOffices = officesForDivision(division);

    for (const model of models) {
      if (!expandedArticles.has(articleKey(division.name, model))) continue;

      const articles = getArticleCodesForModel(division.name, model);
      for (const office of divOffices) {
        const modelTotal = parseInt(values[rowKey(model, office.name)], 10) || 0;
        let articleSum = 0;
        let hasArticleValue = false;

        for (const code of articles) {
          const units = parseInt(articleValues[rowKey(model, office.name, code)], 10) || 0;
          if (units > 0) hasArticleValue = true;
          articleSum += units;
        }

        if (hasArticleValue && articleSum !== modelTotal) {
          errors.push({
            division: division.name,
            model,
            office: office.label,
            officeName: office.name,
            modelTotal,
            articleSum,
            diff: articleSum - modelTotal,
          });
        }
      }
    }
  }

  return errors;
}

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
  const [expandedDivisions, setExpandedDivisions] = useState(() => new Set(divisions.map((d) => d.id)));
  const [expandedArticles, setExpandedArticles] = useState(() => new Set());
  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [articleValues, setArticleValues] = useState({});
  const [articleRecordIds, setArticleRecordIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const salesGroupOptions = showAllGroups ? getSalesGroups() : getPrimarySalesGroups();
  const salesGroup = getSalesGroupByCode(salesGroupCode);

  const offices = useMemo(
    () => getUnionOfficesForUser(user, divisions),
    [user, divisions]
  );

  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const isLocked = readOnly || !editable;

  // In review mode, default to first sales group present in saved targets
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

  const officesForDivision = useCallback(
    (division) => {
      const names = new Set(
        getUnionOfficesForUser(user, [division]).map((o) => o.name)
      );
      return offices.filter((o) => names.has(o.name));
    },
    [user, offices]
  );

  // Hydrate grid from saved targets + articles
  useEffect(() => {
    if (!salesGroup) return;

    const nextValues = {};
    const nextIds = {};
    const nextArticleValues = {};
    const nextArticleIds = {};

    const modelAllocByTargetId = Object.fromEntries(
      modelAllocations.map((m) => [m.target_id, m])
    );

    for (const division of divisions) {
      const models = getModels(division, salesGroup);
      const divOffices = officesForDivision(division);

      for (const model of models) {
        for (const office of divOffices) {
          const key = rowKey(model, office.name);
          const existing = findExistingTarget(
            targets,
            division.name,
            salesGroup.name,
            model,
            office.name
          );
          nextValues[key] = existing ? String(existing.target_units) : "";
          if (existing) nextIds[key] = existing.id;

          const modelAlloc = existing ? modelAllocByTargetId[existing.id] : null;
          if (modelAlloc) {
            const articles = articleAllocations.filter(
              (a) => a.model_allocation_id === modelAlloc.id
            );
            for (const art of articles) {
              const aKey = rowKey(model, office.name, art.article_code);
              nextArticleValues[aKey] = String(art.units);
              nextArticleIds[aKey] = art.id;
            }
          }
        }
      }
    }

    setValues(nextValues);
    setRecordIds(nextIds);
    setArticleValues(nextArticleValues);
    setArticleRecordIds(nextArticleIds);

    if (readOnly) {
      const articleExpand = new Set();
      for (const division of divisions) {
        const models = getModels(division, salesGroup);
        const divOffices = officesForDivision(division);
        for (const model of models) {
          const codes = getArticleCodesForModel(division.name, model);
          const hasArticleData = codes.some((code) =>
            divOffices.some((office) => {
              const aKey = rowKey(model, office.name, code);
              return nextArticleValues[aKey] && parseInt(nextArticleValues[aKey], 10) > 0;
            })
          );
          if (hasArticleData) articleExpand.add(articleKey(division.name, model));
        }
      }
      setExpandedArticles(articleExpand);
    }

    setError("");
    setMessage("");
  }, [
    divisions,
    salesGroup,
    offices,
    targets,
    modelAllocations,
    articleAllocations,
    officesForDivision,
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
        officesForDivision,
      }),
    [divisions, salesGroup, expandedArticles, values, articleValues, officesForDivision]
  );

  const mismatchLookup = useMemo(() => {
    const set = new Set();
    for (const e of articleMismatchErrors) {
      set.add(`${e.division}::${e.model}::${e.officeName}`);
    }
    return set;
  }, [articleMismatchErrors]);

  function isCellMismatch(divisionName, model, officeName) {
    return mismatchLookup.has(`${divisionName}::${model}::${officeName}`);
  }

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

  function toggleArticles(divisionName, model) {
    const key = articleKey(divisionName, model);
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
        `Article totals must match model totals for ${articleMismatchErrors.length} cell(s). Fix the highlighted rows before saving.`
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
        const divOffices = officesForDivision(division);

        for (const model of models) {
          for (const office of divOffices) {
            const key = rowKey(model, office.name);
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
              sales_office: office.name,
              target_units: units,
            });

            if (expandedArticles.has(articleKey(division.name, model))) {
              const articles = getArticleCodesForModel(division.name, model);
              for (const code of articles) {
                const aKey = rowKey(model, office.name, code);
                const aRaw = articleValues[aKey];
                const aUnits = aRaw === "" || aRaw === undefined ? 0 : parseInt(aRaw, 10);
                if (aUnits > 0) {
                  articlePayload.push({
                    brand: division.name,
                    sales_group: salesGroup.name,
                    model,
                    sales_office: office.name,
                    articleCode: code,
                    units: aUnits,
                  });
                }
              }
            }
          }
        }
      }

      if (
        targetPayload.length === 0 ||
        targetPayload.every((t) => !t.target_units)
      ) {
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
        const cellKey = `${row.brand}::${row.sales_group}::${row.model}::${row.sales_office || ""}`;
        const id = saveData.idByKey?.[cellKey];
        const key = rowKey(row.model, row.sales_office);
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

  const hasGrid = salesGroup && divisions.length > 0 && offices.length > 0;

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
                New
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
            <button
              type="button"
              onClick={() => setShowAllGroups((v) => !v)}
              className="text-[11px] text-slate-500 underline-offset-2 hover:underline"
            >
              {showAllGroups ? "Show primary" : "Show all groups"}
            </button>
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
                  <li key={`${e.division}-${e.model}-${e.officeName}`}>
                    {e.division} {e.model} / {e.office}: model {e.modelTotal} vs articles{" "}
                    {e.articleSum} ({e.diff > 0 ? "+" : ""}
                    {e.diff})
                  </li>
                ))}
                {articleMismatchErrors.length > 5 && (
                  <li>…and {articleMismatchErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!hasGrid && (
        <p className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No sales offices or divisions are available for your account.
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
                <th
                  colSpan={offices.length}
                  className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-700"
                >
                  Month to Date
                </th>
              </tr>
              <tr className="bg-rose-50">
                <th
                  colSpan={3}
                  className="sticky left-0 z-20 border border-slate-300 bg-rose-50 px-3 py-1.5 text-left text-xs font-medium text-slate-600"
                >
                  Sales Group
                </th>
                <th
                  colSpan={offices.length}
                  className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-800"
                >
                  {salesGroup?.name}
                </th>
              </tr>
              <tr className="bg-slate-100">
                <th
                  colSpan={3}
                  className="sticky left-0 z-20 border border-slate-300 bg-slate-100 px-3 py-1.5 text-left text-xs font-medium text-slate-600"
                >
                  Sales Office
                </th>
                {offices.map((office) => (
                  <th
                    key={`code-${office.name}`}
                    className="min-w-[88px] border border-slate-300 px-2 py-1.5 text-center text-xs font-semibold text-slate-700"
                  >
                    {office.code}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-20 min-w-[36px] border border-slate-300 bg-slate-50 px-1 py-1.5" />
                <th className="sticky left-[36px] z-20 min-w-[100px] border border-slate-300 bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Model
                </th>
                <th className="sticky left-[136px] z-20 min-w-[120px] border border-slate-300 bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name / Article
                </th>
                {offices.map((office) => (
                  <th
                    key={`label-${office.name}`}
                    className="min-w-[88px] border border-slate-300 px-2 py-1.5 text-center text-[11px] font-medium leading-tight text-slate-600"
                  >
                    {office.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {divisions.map((division) => {
                const models = getModels(division, salesGroup);
                const divOffices = officesForDivision(division);
                const isExpanded = expandedDivisions.has(division.id);
                const divisionTotal = models.reduce((sum, model) => {
                  return (
                    sum +
                    divOffices.reduce((s, office) => {
                      const raw = values[rowKey(model, office.name)];
                      return s + (parseInt(raw, 10) || 0);
                    }, 0)
                  );
                }, 0);

                return (
                  <Fragment key={`div-${division.id}`}>
                    <tr
                      className="cursor-pointer bg-slate-200/70 font-semibold hover:bg-slate-200"
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
                      {offices.map((office) => {
                        const colTotal = models.reduce((sum, model) => {
                          if (!divOffices.some((o) => o.name === office.name)) return sum;
                          const raw = values[rowKey(model, office.name)];
                          return sum + (parseInt(raw, 10) || 0);
                        }, 0);
                        const applies = divOffices.some((o) => o.name === office.name);
                        return (
                          <td
                            key={`div-total-${division.id}-${office.name}`}
                            className="border border-slate-300 px-2 py-2 text-center tabular-nums text-slate-700"
                          >
                            {applies && colTotal > 0 ? colTotal : ""}
                          </td>
                        );
                      })}
                    </tr>

                    {isExpanded &&
                      models.map((model, rowIndex) => {
                        const articles = getArticleCodesForModel(division.name, model);
                        const hasArticles = articles.length > 0;
                        const showArticles = expandedArticles.has(
                          articleKey(division.name, model)
                        );

                        return (
                          <Fragment key={`model-${division.id}-${model}`}>
                            <tr
                              className={cn(
                                rowIndex % 2 === 0 ? "bg-sky-50/40" : "bg-white",
                                offices.some((office) =>
                                  divOffices.some((o) => o.name === office.name) &&
                                  isCellMismatch(division.name, model, office.name)
                                ) && "bg-red-50/80"
                              )}
                            >
                              <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-1 py-1 text-center">
                                {hasArticles && (
                                  <button
                                    type="button"
                                    onClick={() => toggleArticles(division.name, model)}
                                    className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                                    title={
                                      showArticles
                                        ? "Hide article breakdown"
                                        : "Show optional article breakdown"
                                    }
                                  >
                                    {showArticles ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="sticky left-[36px] z-10 border border-slate-200 bg-inherit px-2 py-1.5 font-mono text-xs text-slate-600">
                                {model}
                              </td>
                              <td className="sticky left-[136px] z-10 border border-slate-200 bg-inherit px-2 py-1.5">
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
                              {offices.map((office) => {
                                const applies = divOffices.some((o) => o.name === office.name);
                                const key = rowKey(model, office.name);
                                return (
                                  <td key={key} className="border border-slate-200 p-0">
                                    {applies ? (
                                      isLocked ? (
                                        <div className="flex h-8 items-center justify-center px-1 text-sm tabular-nums text-slate-900">
                                          {values[key] || ""}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          className={cn(
                                            "h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50",
                                            isCellMismatch(division.name, model, office.name) &&
                                              "bg-red-100 ring-1 ring-inset ring-red-300"
                                          )}
                                          value={values[key] ?? ""}
                                          onChange={(e) => updateCell(key, e.target.value)}
                                          aria-label={`${division.name} ${model} / ${office.label}`}
                                        />
                                      )
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>

                            {showArticles &&
                              articles.map((code) => (
                                <tr
                                  key={`art-${division.id}-${model}-${code}`}
                                  className="bg-amber-50/30 text-xs"
                                >
                                  <td className="sticky left-0 z-10 border border-slate-200 bg-inherit" />
                                  <td className="sticky left-[36px] z-10 border border-slate-200 bg-inherit px-2 py-1 text-slate-400">
                                    ↳
                                  </td>
                                  <td className="sticky left-[136px] z-10 border border-slate-200 bg-inherit px-2 py-1 font-mono text-[11px] text-amber-900">
                                    {code}
                                  </td>
                                  {offices.map((office) => {
                                    const applies = divOffices.some((o) => o.name === office.name);
                                    const aKey = rowKey(model, office.name, code);
                                    return (
                                      <td key={aKey} className="border border-slate-200 p-0">
                                        {applies ? (
                                          isLocked ? (
                                            <div className="flex h-7 items-center justify-center px-1 text-xs tabular-nums text-amber-900">
                                              {articleValues[aKey] || ""}
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              className={cn(
                                                "h-7 w-full bg-transparent px-1 text-center text-xs tabular-nums outline-none focus:bg-amber-100",
                                                isCellMismatch(division.name, model, office.name) &&
                                                  "bg-red-100 ring-1 ring-inset ring-red-300"
                                              )}
                                              value={articleValues[aKey] ?? ""}
                                              onChange={(e) => updateArticleCell(aKey, e.target.value)}
                                              aria-label={`${model} ${code} / ${office.label}`}
                                            />
                                          )
                                        ) : null}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
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
                  Total
                </td>
                {offices.map((office) => {
                  const colTotal = divisions.reduce((sum, division) => {
                    const models = getModels(division, salesGroup);
                    const divOffices = officesForDivision(division);
                    if (!divOffices.some((o) => o.name === office.name)) return sum;
                    return (
                      sum +
                      models.reduce((s, model) => {
                        const raw = values[rowKey(model, office.name)];
                        return s + (parseInt(raw, 10) || 0);
                      }, 0)
                    );
                  }, 0);
                  return (
                    <td
                      key={`total-${office.name}`}
                      className="border border-slate-300 px-2 py-2 text-center tabular-nums text-slate-900"
                    >
                      {colTotal || ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <p>
          Expand a division to see its models · Optional article breakdown per model · Grid total:{" "}
          <span className="font-semibold text-slate-800">{total.toLocaleString()}</span> units
        </p>
      </div>

      {!readOnly && (
        <CreatePlanModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}
