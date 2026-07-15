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
import { planSlug } from "@/lib/plans";
import { Save, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

function articleRowKey(divisionName, model) {
  return `${divisionName}::${model}`;
}

/** D&S model total = targets with no sales_office. */
function dsModelTotal(targets, brand, salesGroup, model) {
  return (targets || [])
    .filter(
      (t) =>
        t.brand === brand &&
        t.sales_group === salesGroup &&
        t.model === model &&
        !t.sales_office
    )
    .reduce((sum, t) => sum + (t.target_units || 0), 0);
}

function findOfficeTarget(targets, brand, salesGroup, model, officeName) {
  return (targets || []).find(
    (t) =>
      t.brand === brand &&
      t.sales_group === salesGroup &&
      t.model === model &&
      t.sales_office === officeName
  );
}

/**
 * NPM / Retail Head grid — same Model × Sales Office layout as the original D&S grid.
 * Cells are editable office splits; model totals come from Demand & Supply.
 */
export function NpmOfficeAllocationPanel({
  plan,
  targets = [],
  modelAllocations = [],
  articleAllocations = [],
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
  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [articleValues, setArticleValues] = useState({});
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
    const withModels = targets.find((t) => t.model && !t.sales_office);
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

    const nextValues = {};
    const nextIds = {};
    const nextArticles = {};
    const articleExpand = new Set();

    const modelAllocByTargetId = Object.fromEntries(
      modelAllocations.map((m) => [m.target_id, m])
    );

    for (const division of divisions) {
      const models = getModels(division, salesGroup);
      const divOffices = officesForDivision(division);

      for (const model of models) {
        const dsTotal = dsModelTotal(targets, division.name, salesGroup.name, model);
        if (dsTotal <= 0) continue;

        for (const office of divOffices) {
          const key = rowKey(model, office.name);
          const existing = findOfficeTarget(
            targets,
            division.name,
            salesGroup.name,
            model,
            office.name
          );
          nextValues[key] = existing ? String(existing.target_units) : "";
          if (existing) nextIds[key] = existing.id;
        }

        // Articles: show when D&S defined article allocs on the model-level target
        const dsTarget = (targets || []).find(
          (t) =>
            t.brand === division.name &&
            t.sales_group === salesGroup.name &&
            t.model === model &&
            !t.sales_office
        );
        const modelAlloc = dsTarget ? modelAllocByTargetId[dsTarget.id] : null;
        if (modelAlloc) {
          const arts = articleAllocations.filter(
            (a) => a.model_allocation_id === modelAlloc.id
          );
          if (arts.length) {
            articleExpand.add(articleRowKey(division.name, model));
            for (const office of divOffices) {
              for (const art of arts) {
                // Office-level article cells start empty; proportion optional later
                const aKey = rowKey(model, office.name, art.article_code);
                if (nextArticles[aKey] === undefined) nextArticles[aKey] = "";
              }
            }
          }
        }
      }
    }

    setValues(nextValues);
    setRecordIds(nextIds);
    setArticleValues(nextArticles);
    setExpandedArticles(articleExpand);
    setError("");
    setMessage("");
  }, [
    divisions,
    salesGroup,
    targets,
    modelAllocations,
    articleAllocations,
    officesForDivision,
  ]);

  const mismatchErrors = useMemo(() => {
    if (!salesGroup) return [];
    const errors = [];
    for (const division of divisions) {
      const models = getModels(division, salesGroup);
      const divOffices = officesForDivision(division);
      for (const model of models) {
        const dsTotal = dsModelTotal(targets, division.name, salesGroup.name, model);
        if (dsTotal <= 0) continue;

        let officeSum = 0;
        for (const office of divOffices) {
          officeSum += parseInt(values[rowKey(model, office.name)], 10) || 0;
        }

        // Only over-allocation is an error; under-allocation is OK while editing
        if (officeSum > dsTotal) {
          errors.push({
            division: division.name,
            model,
            dsTotal,
            officeSum,
            diff: officeSum - dsTotal,
          });
        }
      }
    }
    return errors;
  }, [divisions, salesGroup, targets, values, officesForDivision]);

  const mismatchLookup = useMemo(() => {
    const set = new Set();
    for (const e of mismatchErrors) set.add(`${e.division}::${e.model}`);
    return set;
  }, [mismatchErrors]);

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

  function updateCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateArticleCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setArticleValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!salesGroup) {
      setError("Select a Sales Group first.");
      return;
    }
    if (mismatchErrors.length > 0) {
      setError(
        `Office totals exceed Demand & Supply model totals for ${mismatchErrors.length} model(s).`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const targetPayload = [];

      for (const division of divisions) {
        const models = getModels(division, salesGroup);
        const divOffices = officesForDivision(division);

        for (const model of models) {
          const dsTotal = dsModelTotal(targets, division.name, salesGroup.name, model);
          if (dsTotal <= 0) continue;

          for (const office of divOffices) {
            const key = rowKey(model, office.name);
            const raw = values[key];
            const units = raw === "" || raw === undefined ? 0 : parseInt(raw, 10);
            if (Number.isNaN(units) || units < 0) {
              throw new Error(`Invalid units for ${model} / ${office.label}`);
            }
            if (!recordIds[key] && units === 0) continue;

            targetPayload.push({
              brand: division.name,
              sales_group: salesGroup.name,
              model,
              sales_office: office.name,
              target_units: units,
            });
          }
        }
      }

      const res = await fetch("/api/plans/save-npm-grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: plan.id,
          salesGroup: salesGroup.name,
          targets: targetPayload,
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
            disabled={saving || !hasGrid || mismatchErrors.length > 0}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save office allocations"}
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Models and totals come from Demand &amp; Supply. Split each model across sales offices.
        Partial allocations are fine to save; only going over the D&amp;S total is blocked. Full
        match is required before Mark Retail Allocation Complete.
      </p>

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {mismatchErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Over-allocated vs Demand &amp; Supply</p>
              <ul className="mt-1 space-y-1 text-xs">
                {mismatchErrors.slice(0, 6).map((e) => (
                  <li key={`${e.division}-${e.model}`}>
                    {e.division} {e.model}: D&amp;S {e.dsTotal} vs offices {e.officeSum} (+
                    {e.diff})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!hasGrid && (
        <div className="space-y-3 border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">Nothing to allocate for this sales group yet</p>
          <p>
            National Performance Manager splits <span className="font-medium">model targets</span>{" "}
            across sales offices. Demand &amp; Supply must first save Brand → Model units (e.g.
            Corolla 50, Camry 40) for <span className="font-medium">{salesGroup?.name}</span>.
          </p>
          <p className="text-xs text-slate-500">
            Brand-only totals without a model do not appear in this grid.
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
                      className="cursor-pointer bg-slate-50 font-semibold hover:bg-slate-100"
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
                          ? models.reduce((sum, model) => {
                              const raw = values[rowKey(model, office.name)];
                              return sum + (parseInt(raw, 10) || 0);
                            }, 0)
                          : 0;
                        return (
                          <td
                            key={`div-${division.id}-${office.name}`}
                            className="border border-slate-300 px-1 py-2 text-center tabular-nums text-slate-700"
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
                        const showArticles = expandedArticles.has(
                          articleRowKey(division.name, model)
                        );
                        const hasArticleCodes = articles.length > 0 && showArticles;

                        return (
                          <Fragment key={`${division.id}-${model}`}>
                            <tr
                              className={cn(
                                rowIndex % 2 === 0 ? "bg-sky-50/40" : "bg-white",
                                mismatched && "bg-red-50/80"
                              )}
                            >
                              <td className="sticky left-0 z-10 w-8 border border-slate-200 bg-inherit px-1 text-center">
                                {articles.length > 0 && (
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
                              </td>
                              <td className="sticky left-[14.5rem] z-10 min-w-[5rem] border border-slate-200 bg-inherit px-2 py-1.5 text-center font-semibold tabular-nums text-slate-800">
                                {dsTotal}
                              </td>
                              {offices.map((office) => {
                                const applies = divOffices.some((o) => o.name === office.name);
                                const key = rowKey(model, office.name);
                                return (
                                  <td key={key} className="min-w-[4.5rem] border border-slate-200 p-0">
                                    {applies ? (
                                      isLocked ? (
                                        <div className="flex h-8 items-center justify-center text-sm tabular-nums">
                                          {values[key] || ""}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          className={cn(
                                            "h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50",
                                            mismatched &&
                                              "bg-red-100 ring-1 ring-inset ring-red-300"
                                          )}
                                          value={values[key] ?? ""}
                                          onChange={(e) => updateCell(key, e.target.value)}
                                          aria-label={`${model} / ${getOfficeLabel(office)}`}
                                        />
                                      )
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>

                            {hasArticleCodes &&
                              articles.map((code) => (
                                <tr
                                  key={`${division.id}-${model}-${code}`}
                                  className="bg-amber-50/30 text-xs"
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
                                    return (
                                      <td key={aKey} className="min-w-[4.5rem] border border-slate-200 p-0">
                                        {applies ? (
                                          isLocked ? (
                                            <div className="flex h-7 items-center justify-center text-xs tabular-nums text-amber-900">
                                              {articleValues[aKey] || ""}
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              className="h-7 w-full bg-transparent px-1 text-center text-xs tabular-nums outline-none focus:bg-amber-100"
                                              value={articleValues[aKey] ?? ""}
                                              onChange={(e) =>
                                                updateArticleCell(aKey, e.target.value)
                                              }
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
