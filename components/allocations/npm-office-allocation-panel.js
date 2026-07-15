"use client";

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
  getSalesGroupByCode,
  getSalesGroupByName,
  getUnionOfficesForUser,
  getModels,
  getOfficeLabel,
  rowKey,
} from "@/src/data";
import { getArticleCodesForModel } from "@/lib/constants";
import {
  allocationModeLabel,
  buildLeafSavePayload,
  clearArticleValuesForModel,
  clearModelValuesForModel,
  computeAllocationStatus,
  detectModelAllocationMode,
  effectiveModelOfficeUnits,
  isArticleOfficeEditable,
  isModelOfficeEditable,
  modelAllocatedTotal,
  modelHasArticles,
  rollupBrandOfficeUnits,
} from "@/lib/npm-allocation-rollup";
import { planSlug } from "@/lib/plans";
import { Save, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

function articleRowKey(divisionName, model) {
  return `${divisionName}::${model}`;
}

/** D&S model total = targets with no sales_office and no article_code. */
function dsModelTotal(targets, brand, salesGroup, model) {
  return (targets || [])
    .filter(
      (t) =>
        t.brand === brand &&
        t.sales_group === salesGroup &&
        t.model === model &&
        !t.sales_office &&
        !t.article_code
    )
    .reduce((sum, t) => sum + (t.target_units || 0), 0);
}

function findOfficeTarget(targets, brand, salesGroup, model, officeName) {
  return (targets || []).find(
    (t) =>
      t.brand === brand &&
      t.sales_group === salesGroup &&
      t.model === model &&
      t.sales_office === officeName &&
      !t.article_code
  );
}

function findArticleOfficeTarget(targets, brand, salesGroup, model, officeName, articleCode) {
  return (targets || []).find(
    (t) =>
      t.brand === brand &&
      t.sales_group === salesGroup &&
      t.model === model &&
      t.sales_office === officeName &&
      t.article_code === articleCode
  );
}

/**
 * NPM Sales Office Allocation — Brand → Model → Article.
 * Models with articles: exclusive Model OR Article mode (with confirm to switch).
 * Brand cells are always calculated roll-ups.
 */
export function NpmOfficeAllocationPanel({
  plan,
  targets = [],
  periods = [],
  editable = true,
  user = null,
}) {
  const router = useRouter();
  const divisions = useMemo(() => getDivisionsForUser(user), [user]);

  const [salesGroupCode, setSalesGroupCode] = useState("001");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState(
    () => new Set(divisions.map((d) => d.id))
  );
  const [expandedArticles, setExpandedArticles] = useState(() => new Set());
  const [modelValues, setModelValues] = useState({});
  const [articleValues, setArticleValues] = useState({});
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const salesGroupOptions = showAllGroups ? getSalesGroups() : getPrimarySalesGroups();
  const salesGroup = getSalesGroupByCode(salesGroupCode);
  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const isLocked = !editable;

  const offices = useMemo(
    () => getUnionOfficesForUser(user, divisions),
    [user, divisions]
  );

  const officesForDivision = useCallback(
    (division) => {
      const names = new Set(
        getUnionOfficesForUser(user, [division]).map((o) => o.name)
      );
      return offices.filter((o) => names.has(o.name));
    },
    [user, offices]
  );

  useEffect(() => {
    if (targets.length === 0) return;
    const withModels = targets.find((t) => t.model && !t.sales_office && !t.article_code);
    const sg = getSalesGroupByName(withModels?.sales_group || targets[0].sales_group);
    if (sg) setSalesGroupCode(sg.code);
  }, [targets]);

  useEffect(() => {
    if (salesGroupOptions.length === 0) return;
    if (!salesGroupOptions.some((g) => g.code === salesGroupCode)) {
      setSalesGroupCode(salesGroupOptions[0].code);
    }
  }, [salesGroupOptions, salesGroupCode]);

  useEffect(() => {
    if (!salesGroup) return;

    const nextModelValues = {};
    const nextArticles = {};
    const articleExpand = new Set();

    for (const division of divisions) {
      const models = getModels(division, salesGroup);
      const divOffices = officesForDivision(division);

      for (const model of models) {
        const dsTotal = dsModelTotal(targets, division.name, salesGroup.name, model);
        if (dsTotal <= 0) continue;

        const articleCodes = getArticleCodesForModel(division.name, model);
        const hasArticles = modelHasArticles(articleCodes);

        // Detect stored source: prefer article leaves if any exist for this model
        let hasStoredArticles = false;
        if (hasArticles) {
          for (const office of divOffices) {
            for (const code of articleCodes) {
              const existing = findArticleOfficeTarget(
                targets,
                division.name,
                salesGroup.name,
                model,
                office.name,
                code
              );
              if (existing && existing.target_units > 0) {
                hasStoredArticles = true;
                break;
              }
            }
            if (hasStoredArticles) break;
          }
        }

        if (hasArticles) {
          articleExpand.add(articleRowKey(division.name, model));
          for (const office of divOffices) {
            for (const code of articleCodes) {
              const aKey = rowKey(model, office.name, code);
              if (hasStoredArticles) {
                const existing = findArticleOfficeTarget(
                  targets,
                  division.name,
                  salesGroup.name,
                  model,
                  office.name,
                  code
                );
                nextArticles[aKey] = existing ? String(existing.target_units) : "";
              } else {
                nextArticles[aKey] = "";
              }
            }
          }
        }

        // Model leaves only when not in stored article mode
        if (!hasStoredArticles) {
          for (const office of divOffices) {
            const key = rowKey(model, office.name);
            const existing = findOfficeTarget(
              targets,
              division.name,
              salesGroup.name,
              model,
              office.name
            );
            nextModelValues[key] = existing ? String(existing.target_units) : "";
          }
        }
      }
    }

    setModelValues(nextModelValues);
    setArticleValues(nextArticles);
    setExpandedArticles(articleExpand);
    setPendingSwitch(null);
    setError("");
    setMessage("");
  }, [divisions, salesGroup, targets, officesForDivision]);

  const allocationStatus = useMemo(() => {
    if (!salesGroup) {
      return {
        errors: [],
        remainingModels: [],
        brandSummaries: [],
        isFullyAllocated: false,
      };
    }
    return computeAllocationStatus({
      divisions,
      salesGroupName: salesGroup.name,
      targets,
      articleValues,
      modelValues,
      officesForDivision,
      getModelsForDivision: (division) => getModels(division, salesGroup),
      getArticleCodesForModel: (brand, model) => getArticleCodesForModel(brand, model),
      dsModelTotalFn: dsModelTotal,
      rowKeyFn: rowKey,
    });
  }, [
    divisions,
    salesGroup,
    targets,
    articleValues,
    modelValues,
    officesForDivision,
  ]);

  const mismatchLookup = useMemo(() => {
    const set = new Set();
    for (const e of allocationStatus.errors) {
      if (e.model) set.add(`${e.division}::${e.model}`);
      else if (e.division) set.add(e.division);
    }
    return set;
  }, [allocationStatus.errors]);

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/allocations?plan=${slug}`);
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

  function requestModelEdit({ division, model, offices: modelOffices, key, value }) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    const articleCodes = getArticleCodesForModel(division.name, model);
    const mode = detectModelAllocationMode({
      articleValues,
      modelValues,
      model,
      offices: modelOffices,
      articleCodes,
      rowKeyFn: rowKey,
    });

    if (mode === "article") {
      setPendingSwitch({
        direction: "to-model",
        divisionName: division.name,
        model,
        offices: modelOffices,
        articleCodes,
        key,
        value,
        message:
          "Switching to model-level allocation will clear the article allocations.",
      });
      return;
    }
    setModelValues((prev) => ({ ...prev, [key]: value }));
  }

  function requestArticleEdit({ division, model, offices: modelOffices, key, value }) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    const articleCodes = getArticleCodesForModel(division.name, model);
    const mode = detectModelAllocationMode({
      articleValues,
      modelValues,
      model,
      offices: modelOffices,
      articleCodes,
      rowKeyFn: rowKey,
    });

    if (mode === "model") {
      setPendingSwitch({
        direction: "to-article",
        divisionName: division.name,
        model,
        offices: modelOffices,
        articleCodes,
        key,
        value,
        message:
          "Switching to article-level allocation will clear the model-level value.",
      });
      return;
    }
    setArticleValues((prev) => ({ ...prev, [key]: value }));
  }

  function confirmPendingSwitch() {
    if (!pendingSwitch) return;
    const { direction, model, offices: modelOffices, articleCodes, key, value } =
      pendingSwitch;

    if (direction === "to-model") {
      setArticleValues((prev) =>
        clearArticleValuesForModel(prev, model, modelOffices, articleCodes, rowKey)
      );
      setModelValues((prev) => ({ ...prev, [key]: value }));
    } else {
      setModelValues((prev) => clearModelValuesForModel(prev, model, modelOffices, rowKey));
      setArticleValues((prev) => ({ ...prev, [key]: value }));
    }
    setPendingSwitch(null);
  }

  async function handleSave() {
    if (!salesGroup) {
      setError("Select a Sales Group first.");
      return;
    }
    if (allocationStatus.errors.length > 0) {
      setError(
        `Fix over-allocations for ${allocationStatus.errors.length} item(s) before saving.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { articles, models } = buildLeafSavePayload({
        divisions,
        salesGroupName: salesGroup.name,
        targets,
        articleValues,
        modelValues,
        officesForDivision,
        getModelsForDivision: (division) => getModels(division, salesGroup),
        getArticleCodesForModel: (brand, model) => getArticleCodesForModel(brand, model),
        dsModelTotalFn: dsModelTotal,
        rowKeyFn: rowKey,
      });

      const res = await fetch("/api/plans/save-npm-grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: plan.id,
          salesGroup: salesGroup.name,
          articles,
          models,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save allocations");

      setMessage(
        `Saved office allocations (${data.savedCount || 0} line${
          (data.savedCount || 0) === 1 ? "" : "s"
        }).`
      );
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const modelsWithDs = useMemo(() => {
    if (!salesGroup) return [];
    const rows = [];
    for (const division of divisions) {
      for (const model of getModels(division, salesGroup)) {
        const total = dsModelTotal(targets, division.name, salesGroup.name, model);
        if (total > 0) rows.push({ division, model, total });
      }
    }
    return rows;
  }, [divisions, salesGroup, targets]);

  const hasGrid = salesGroup && modelsWithDs.length > 0 && offices.length > 0;
  const remainingModels = allocationStatus.remainingModels;
  const brandRollups = allocationStatus.brandSummaries;
  const overErrors = allocationStatus.errors;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-[160px] space-y-1">
          <Label className="text-xs text-slate-500">Month</Label>
          <Select
            value={planPath}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-9"
            disabled={isLocked}
          >
            {monthOptions.map((p) => (
              <option key={p.id} value={planSlug(p.month, p.year)}>
                {formatPeriod(p.month, p.year)}
              </option>
            ))}
          </Select>
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
            disabled={isLocked}
            className="h-9"
          >
            {salesGroupOptions.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code} — {g.name}
              </option>
            ))}
          </Select>
        </div>

        {!isLocked && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasGrid || overErrors.length > 0}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save office allocations"}
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        For models with articles, choose either model-level allocation (e.g. Corolla = 50) or
        article-level allocation (articles sum to the model). Only one source can be active per
        model. Brand totals are always calculated.
      </p>

      {pendingSwitch && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-slate-800">
            <span className="font-medium">
              {pendingSwitch.divisionName} {pendingSwitch.model}:
            </span>{" "}
            {pendingSwitch.message}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingSwitch(null)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={confirmPendingSwitch}>
              Switch
            </Button>
          </div>
        </div>
      )}

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {overErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {overErrors.slice(0, 8).map((e) => (
                <p key={`${e.type}-${e.division}-${e.model || ""}`} className="text-xs">
                  {e.type === "brand_over" ? (
                    <>
                      {e.division} brand: allocated {e.allocated} exceeds D&amp;S {e.dsTotal} (+
                      {e.diff})
                    </>
                  ) : (
                    <>
                      {e.division} {e.model}: allocated {e.allocated} exceeds D&amp;S {e.dsTotal} (+
                      {e.diff})
                    </>
                  )}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {remainingModels.length > 0 && overErrors.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Still remaining to allocate</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {remainingModels.slice(0, 8).map((r) => (
              <li key={`${r.division}-${r.model}`}>
                {r.division} {r.model}: {r.allocated} of {r.dsTotal} ({r.remaining} left)
              </li>
            ))}
          </ul>
          {brandRollups.some((b) => b.remaining > 0 && b.allocatedBrand > 0) && (
            <ul className="mt-2 space-y-0.5 border-t border-amber-200 pt-2 text-xs">
              {brandRollups
                .filter((b) => b.remaining > 0 && b.allocatedBrand > 0)
                .map((b) => (
                  <li key={b.division}>
                    {b.division} brand: {b.allocatedBrand} of {b.dsBrand} ({b.remaining} left)
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {!hasGrid && (
        <div className="space-y-3 border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">Nothing to allocate for this sales group yet</p>
          <p>
            National Performance Manager splits <span className="font-medium">model targets</span>{" "}
            across sales offices. Demand &amp; Supply must first save Brand → Model units for{" "}
            <span className="font-medium">{salesGroup?.name}</span>.
          </p>
        </div>
      )}

      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-rose-100/80">
                <th
                  colSpan={4}
                  className="sticky left-0 z-20 border border-slate-300 bg-rose-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-700"
                >
                  {formatPeriod(plan.month, plan.year)} · Sales Office Allocation
                </th>
                <th
                  colSpan={offices.length}
                  className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-700"
                >
                  Sales Offices
                </th>
              </tr>
              <tr className="bg-rose-50">
                <th
                  colSpan={4}
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
                <th className="sticky left-0 z-20 w-8 border border-slate-300 bg-slate-100" />
                <th className="sticky left-8 z-20 min-w-[6rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left text-xs text-slate-500">
                  Code
                </th>
                <th className="sticky left-[7.5rem] z-20 min-w-[7rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left text-xs text-slate-500">
                  Model
                </th>
                <th className="sticky left-[14.5rem] z-20 min-w-[5rem] border border-slate-300 bg-slate-100 px-2 py-1 text-center text-xs text-slate-500">
                  D&amp;S Total
                </th>
                {offices.map((office) => (
                  <th
                    key={`code-${office.name}`}
                    className="min-w-[4.5rem] border border-slate-300 px-1 py-1 text-center font-mono text-[10px] text-slate-600"
                  >
                    {office.code}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-20 w-8 border border-slate-300 bg-slate-50" />
                <th className="sticky left-8 z-20 min-w-[6rem] border border-slate-300 bg-slate-50 px-2 py-1 text-left text-xs text-slate-400">
                  —
                </th>
                <th className="sticky left-[7.5rem] z-20 min-w-[7rem] border border-slate-300 bg-slate-50 px-2 py-1 text-left text-xs text-slate-400">
                  —
                </th>
                <th className="sticky left-[14.5rem] z-20 min-w-[5rem] border border-slate-300 bg-slate-50 px-2 py-1 text-center text-xs text-slate-400">
                  —
                </th>
                {offices.map((office) => (
                  <th
                    key={`name-${office.name}`}
                    className="min-w-[4.5rem] border border-slate-300 px-1 py-1 text-center text-[10px] font-medium leading-tight text-slate-700"
                  >
                    {getOfficeLabel(office)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {divisions.map((division) => {
                const models = getModels(division, salesGroup).filter(
                  (model) => dsModelTotal(targets, division.name, salesGroup.name, model) > 0
                );
                if (models.length === 0) return null;

                const isExpanded = expandedDivisions.has(division.id);
                const divOffices = officesForDivision(division);
                const divisionDs = models.reduce(
                  (s, model) =>
                    s + dsModelTotal(targets, division.name, salesGroup.name, model),
                  0
                );

                return (
                  <Fragment key={division.id}>
                    <tr
                      className="cursor-pointer bg-slate-100/90 font-semibold hover:bg-slate-100"
                      onClick={() => toggleDivision(division.id)}
                    >
                      <td
                        colSpan={4}
                        className="sticky left-0 z-10 border border-slate-300 bg-inherit px-3 py-2"
                      >
                        <span className="inline-flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {division.name}
                          <span className="text-xs font-normal text-slate-500">
                            ({models.length} models · D&amp;S {divisionDs.toLocaleString()})
                          </span>
                        </span>
                      </td>
                      {offices.map((office) => {
                        const applies = divOffices.some((o) => o.name === office.name);
                        const colTotal = applies
                          ? rollupBrandOfficeUnits({
                              articleValues,
                              modelValues,
                              models,
                              officeName: office.name,
                              getArticleCodes: (m) =>
                                getArticleCodesForModel(division.name, m),
                              rowKeyFn: rowKey,
                              offices: divOffices,
                            })
                          : 0;
                        return (
                          <td
                            key={`div-${division.id}-${office.name}`}
                            className="border border-slate-300 bg-slate-100/80 px-1 py-2 text-center tabular-nums text-slate-600"
                            title="Calculated from model allocations."
                          >
                            {applies && colTotal > 0 ? colTotal : ""}
                          </td>
                        );
                      })}
                    </tr>

                    {isExpanded &&
                      models.map((model, rowIndex) => {
                        const dsTotal = dsModelTotal(
                          targets,
                          division.name,
                          salesGroup.name,
                          model
                        );
                        const mismatched = mismatchLookup.has(`${division.name}::${model}`);
                        const articles = getArticleCodesForModel(division.name, model);
                        const hasArticles = modelHasArticles(articles);
                        const mode = detectModelAllocationMode({
                          articleValues,
                          modelValues,
                          model,
                          offices: divOffices,
                          articleCodes: articles,
                          rowKeyFn: rowKey,
                        });
                        const modelEditable = isModelOfficeEditable(mode, articles);
                        const articleEditable = isArticleOfficeEditable(mode, articles);
                        const showArticles =
                          hasArticles &&
                          expandedArticles.has(articleRowKey(division.name, model));
                        const modelAllocated = modelAllocatedTotal({
                          articleValues,
                          modelValues,
                          model,
                          offices: divOffices,
                          articleCodes: articles,
                          rowKeyFn: rowKey,
                        });

                        return (
                          <Fragment key={`${division.id}-${model}`}>
                            <tr
                              className={cn(
                                rowIndex % 2 === 0 ? "bg-sky-50/40" : "bg-white",
                                mismatched && "bg-red-50/80"
                              )}
                            >
                              <td className="sticky left-0 z-10 w-8 border border-slate-200 bg-inherit px-1 text-center">
                                {hasArticles && (
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                                    onClick={() => {
                                      const k = articleRowKey(division.name, model);
                                      setExpandedArticles((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(k)) next.delete(k);
                                        else next.add(k);
                                        return next;
                                      });
                                    }}
                                  >
                                    {showArticles ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="sticky left-8 z-10 min-w-[6rem] border border-slate-200 bg-inherit px-2 py-1.5 font-mono text-xs text-slate-600">
                                {model}
                              </td>
                              <td className="sticky left-[7.5rem] z-10 min-w-[7rem] border border-slate-200 bg-inherit px-2 py-1.5 font-medium text-slate-900">
                                {model}
                                {hasArticles && (
                                  <span
                                    className={cn(
                                      "mt-0.5 block text-[10px] font-normal",
                                      mode === "article"
                                        ? "text-amber-700"
                                        : mode === "model"
                                          ? "text-sky-700"
                                          : "text-slate-400"
                                    )}
                                  >
                                    {allocationModeLabel(mode)}
                                    {mode !== "none" ? ` · ${modelAllocated}/${dsTotal}` : ""}
                                  </span>
                                )}
                              </td>
                              <td className="sticky left-[14.5rem] z-10 min-w-[5rem] border border-slate-200 bg-inherit px-2 py-1.5 text-center font-semibold tabular-nums text-slate-800">
                                {dsTotal}
                              </td>
                              {offices.map((office) => {
                                const applies = divOffices.some((o) => o.name === office.name);
                                const key = rowKey(model, office.name);
                                const display = applies
                                  ? effectiveModelOfficeUnits({
                                      articleValues,
                                      modelValues,
                                      model,
                                      officeName: office.name,
                                      articleCodes: articles,
                                      rowKeyFn: rowKey,
                                      offices: divOffices,
                                    })
                                  : 0;
                                const showInput = applies && modelEditable && !isLocked;
                                return (
                                  <td
                                    key={key}
                                    className="min-w-[4.5rem] border border-slate-200 p-0"
                                  >
                                    {applies ? (
                                      showInput ? (
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          className={cn(
                                            "h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50",
                                            mismatched &&
                                              "bg-red-100 ring-1 ring-inset ring-red-300"
                                          )}
                                          value={modelValues[key] ?? ""}
                                          onChange={(e) =>
                                            requestModelEdit({
                                              division,
                                              model,
                                              offices: divOffices,
                                              key,
                                              value: e.target.value,
                                            })
                                          }
                                          aria-label={`${model} / ${getOfficeLabel(office)}`}
                                        />
                                      ) : (
                                        <div
                                          className={cn(
                                            "flex h-8 items-center justify-center text-sm tabular-nums",
                                            mode === "article"
                                              ? "bg-slate-50 text-slate-600"
                                              : "text-slate-800"
                                          )}
                                          title={
                                            mode === "article"
                                              ? "Calculated from article allocations."
                                              : undefined
                                          }
                                        >
                                          {display > 0 ? display : ""}
                                        </div>
                                      )
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>

                            {showArticles &&
                              articles.map((code) => (
                                <tr
                                  key={`${division.id}-${model}-${code}`}
                                  className={cn(
                                    "text-xs",
                                    articleEditable ? "bg-amber-50/30" : "bg-slate-50/80 opacity-60"
                                  )}
                                >
                                  <td className="sticky left-0 z-10 w-8 border border-slate-200 bg-inherit" />
                                  <td className="sticky left-8 z-10 min-w-[6rem] border border-slate-200 bg-inherit px-2 py-1 text-slate-400">
                                    ↳
                                  </td>
                                  <td className="sticky left-[7.5rem] z-10 min-w-[7rem] border border-slate-200 bg-inherit px-2 py-1 font-mono text-[11px] text-amber-900">
                                    {code}
                                  </td>
                                  <td className="sticky left-[14.5rem] z-10 min-w-[5rem] border border-slate-200 bg-inherit px-2 py-1 text-center text-[10px] text-slate-400">
                                    —
                                  </td>
                                  {offices.map((office) => {
                                    const applies = divOffices.some(
                                      (o) => o.name === office.name
                                    );
                                    const aKey = rowKey(model, office.name, code);
                                    const showArticleInput =
                                      applies && articleEditable && !isLocked;
                                    return (
                                      <td
                                        key={aKey}
                                        className="min-w-[4.5rem] border border-slate-200 p-0"
                                      >
                                        {applies ? (
                                          showArticleInput ? (
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              className="h-7 w-full bg-transparent px-1 text-center text-xs tabular-nums outline-none focus:bg-amber-100"
                                              value={articleValues[aKey] ?? ""}
                                              onChange={(e) =>
                                                requestArticleEdit({
                                                  division,
                                                  model,
                                                  offices: divOffices,
                                                  key: aKey,
                                                  value: e.target.value,
                                                })
                                              }
                                              aria-label={`${code} / ${getOfficeLabel(office)}`}
                                            />
                                          ) : (
                                            <div className="flex h-7 items-center justify-center text-xs tabular-nums text-slate-400">
                                              {articleValues[aKey] || ""}
                                            </div>
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
