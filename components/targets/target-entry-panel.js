"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatPeriod } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getDivisionsForUser,
  getPrimarySalesGroups,
  getSalesGroups,
  getSalesOfficesForUser,
  getModels,
  getDivisionById,
  getSalesGroupByCode,
  getOfficeShortLabel,
  rowKey,
} from "@/src/data";
import { planLabel, planSlug, planStepPath } from "@/lib/plans";
import { Save, ArrowRight } from "lucide-react";

function findExistingTarget(targets, brand, salesGroup, model, salesOffice) {
  return targets.find((t) => {
    const officeMatch = salesOffice
      ? t.sales_office === salesOffice
      : !t.sales_office;
    return (
      t.brand === brand &&
      t.sales_group === salesGroup &&
      t.model === model &&
      officeMatch
    );
  });
}

export function TargetEntryPanel({
  plan,
  targets,
  periods = [],
  editable = true,
  user = null,
}) {
  const router = useRouter();
  const visibleDivisions = useMemo(() => getDivisionsForUser(user), [user]);

  const [divisionId, setDivisionId] = useState(visibleDivisions[0]?.id || "");
  const [salesGroupCode, setSalesGroupCode] = useState("001");
  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllGroups, setShowAllGroups] = useState(false);

  const division = getDivisionById(divisionId);
  const salesGroupOptions = showAllGroups ? getSalesGroups(division) : getPrimarySalesGroups();
  const salesGroup = getSalesGroupByCode(salesGroupCode);

  const offices = useMemo(
    () => (division ? getSalesOfficesForUser(user, division) : []),
    [user, division]
  );
  const models = useMemo(
    () => (division && salesGroup ? getModels(division, salesGroup) : []),
    [division, salesGroup]
  );

  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const planTitle = planLabel(plan.month, plan.year);

  useEffect(() => {
    if (visibleDivisions.length === 0) return;
    if (!visibleDivisions.some((d) => d.id === divisionId)) {
      setDivisionId(visibleDivisions[0].id);
    }
  }, [visibleDivisions, divisionId]);

  useEffect(() => {
    if (salesGroupOptions.length === 0) return;
    if (!salesGroupOptions.some((g) => g.code === salesGroupCode)) {
      setSalesGroupCode(salesGroupOptions[0].code);
    }
  }, [salesGroupOptions, salesGroupCode]);

  // Hydrate cell values whenever filters / saved targets change
  useEffect(() => {
    if (!division || !salesGroup || models.length === 0) {
      setValues({});
      setRecordIds({});
      return;
    }

    const nextValues = {};
    const nextIds = {};

    for (const model of models) {
      for (const office of offices) {
        const key = rowKey(model, office);
        const existing = findExistingTarget(
          targets,
          division.name,
          salesGroup.name,
          model,
          office
        );
        nextValues[key] = existing ? String(existing.target_units) : "";
        if (existing) nextIds[key] = existing.id;
      }
    }

    setValues(nextValues);
    setRecordIds(nextIds);
    setError("");
    setMessage("");
  }, [division, salesGroup, models, offices, targets]);

  const total = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
    [values]
  );

  const columnTotals = useMemo(() => {
    return offices.map((office) =>
      models.reduce((sum, model) => {
        const raw = values[rowKey(model, office)];
        return sum + (parseInt(raw, 10) || 0);
      }, 0)
    );
  }, [offices, models, values]);

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/monthly-planning/${slug}?step=targets`);
    }
  }

  function updateCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function saveCell(model, office, units) {
    const key = rowKey(model, office);
    const existingId = recordIds[key];
    const payload = {
      planning_period_id: plan.id,
      brand: division.name,
      sales_group: salesGroup.name,
      model,
      sales_office: office,
      target_units: units,
    };

    if (existingId) {
      const res = await fetch("/api/allocations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "targets",
          id: existingId,
          periodId: plan.id,
          data: { target_units: units },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update target");
      return existingId;
    }

    if (units === 0) return null;

    const res = await fetch("/api/allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "targets",
        periodId: plan.id,
        data: payload,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save target");
    return data.data?.id || null;
  }

  async function handleSaveDraft() {
    if (!division || !salesGroup) {
      setError("Select Division and Sales Group first.");
      return;
    }
    if (models.length === 0) {
      setError("No models configured for this Sales Group.");
      return;
    }
    if (offices.length === 0) {
      setError("No sales offices are available for your responsibility.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const nextIds = { ...recordIds };

      for (const model of models) {
        for (const office of offices) {
          const key = rowKey(model, office);
          const raw = values[key];
          const units = raw === "" || raw === undefined ? 0 : parseInt(raw, 10);
          if (Number.isNaN(units) || units < 0) {
            throw new Error(`Invalid target for ${model}`);
          }
          if (!nextIds[key] && units === 0) continue;
          const id = await saveCell(model, office, units);
          if (id) nextIds[key] = id;
        }
      }

      setRecordIds(nextIds);
      setMessage("Targets saved successfully.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save targets");
    } finally {
      setSaving(false);
    }
  }

  const hasGrid = division && salesGroup && models.length > 0 && offices.length > 0;

  return (
    <div className="space-y-4">
      {/* Compact filter bar — no heavy cards */}
      <div className="flex flex-wrap items-end gap-3 border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-[140px] space-y-1">
          <Label className="text-xs text-slate-500">Division</Label>
          <Select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            disabled={!editable || visibleDivisions.length === 0}
            className="h-9"
          >
            {visibleDivisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[160px] space-y-1">
          <Label className="text-xs text-slate-500">Month</Label>
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
        </div>

        <div className="min-w-[200px] flex-1 space-y-1">
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
            disabled={!editable}
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
          {editable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={saving || !hasGrid}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Link
            href={planStepPath("models", plan.month, plan.year)}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            Continue
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {!hasGrid && (
        <p className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {offices.length === 0
            ? "No sales offices are available for your responsibility on this division."
            : "No models configured for this Division and Sales Group."}
        </p>
      )}

      {/* Spreadsheet-style Model × Sales Office matrix */}
      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-rose-100/80">
                <th
                  colSpan={2}
                  className="sticky left-0 z-20 border border-slate-300 bg-rose-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-700"
                >
                  {planTitle}
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
                  colSpan={2}
                  className="sticky left-0 z-20 border border-slate-300 bg-rose-50 px-3 py-1.5 text-left text-xs font-medium text-slate-600"
                >
                  Sales Group
                </th>
                <th
                  colSpan={offices.length}
                  className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-800"
                >
                  {salesGroup.name}
                </th>
              </tr>
              <tr className="bg-slate-100">
                <th className="sticky left-0 z-20 min-w-[120px] border border-slate-300 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Model
                </th>
                <th className="sticky left-[120px] z-20 min-w-[140px] border border-slate-300 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                {offices.map((office) => (
                  <th
                    key={office}
                    className="min-w-[100px] border border-slate-300 px-2 py-2 text-center text-xs font-semibold text-slate-700"
                    title={office}
                  >
                    <div className="leading-tight">{getOfficeShortLabel(office)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((model, rowIndex) => (
                <tr
                  key={model}
                  className={rowIndex % 2 === 0 ? "bg-sky-50/40" : "bg-white"}
                >
                  <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-3 py-1.5 font-mono text-xs text-slate-600">
                    {model}
                  </td>
                  <td className="sticky left-[120px] z-10 border border-slate-200 bg-inherit px-3 py-1.5 font-medium text-slate-900">
                    {model}
                  </td>
                  {offices.map((office) => {
                    const key = rowKey(model, office);
                    return (
                      <td key={key} className="border border-slate-200 p-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="h-9 w-full bg-transparent px-2 text-center text-sm tabular-nums outline-none focus:bg-amber-50 disabled:cursor-not-allowed"
                          value={values[key] ?? ""}
                          onChange={(e) => updateCell(key, e.target.value)}
                          disabled={!editable}
                          placeholder=""
                          aria-label={`${model} / ${office}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-slate-100 font-semibold">
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-3 py-2 text-xs uppercase tracking-wide text-slate-600"
                >
                  Total
                </td>
                {columnTotals.map((colTotal, i) => (
                  <td
                    key={offices[i]}
                    className="border border-slate-300 px-2 py-2 text-center tabular-nums text-slate-900"
                  >
                    {colTotal || ""}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <p>
          Showing {offices.length} sales office{offices.length === 1 ? "" : "s"} for your
          responsibility · Grid total:{" "}
          <span className="font-semibold text-slate-800">{total.toLocaleString()}</span> units
        </p>
      </div>
    </div>
  );
}
