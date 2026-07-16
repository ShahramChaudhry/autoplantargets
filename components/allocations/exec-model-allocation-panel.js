"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn, formatPeriod } from "@/lib/utils";
import {
  getPrimarySalesGroups,
  getSalesGroups,
  getSalesGroupByCode,
  getSalesGroupByName,
  getOfficeLabel,
} from "@/src/data";
import {
  buildExecSavePayload,
  buildOfficeModelTargets,
  cellKey,
  computeExecAllocationStatus,
  execRowTotal,
  parseUnits,
} from "@/lib/exec-allocation-rollup";
import { planSlug } from "@/lib/plans";
import { Save, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Branch Manager grid: Sales Executive × Model for one office.
 * Office model targets are read-only (from NPM). Cells are exec×model only.
 */
export function ExecModelAllocationPanel({
  plan,
  targets = [],
  existingAllocations = [],
  periods = [],
  offices = [],
  executivesByOffice = {},
  editable = true,
  defaultOfficeName = "",
}) {
  const router = useRouter();
  const [salesGroupCode, setSalesGroupCode] = useState("001");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [officeName, setOfficeName] = useState(
    () => defaultOfficeName || offices[0]?.name || ""
  );
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const salesGroupOptions = showAllGroups ? getSalesGroups() : getPrimarySalesGroups();
  const salesGroup = getSalesGroupByCode(salesGroupCode);
  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const isLocked = !editable;
  const officeLocked = offices.length <= 1;

  useEffect(() => {
    if (!offices.length) return;
    if (!offices.some((o) => o.name === officeName)) {
      setOfficeName(offices[0].name);
    }
  }, [offices, officeName]);

  useEffect(() => {
    if (targets.length === 0) return;
    const leaf = targets.find((t) => t.model && t.sales_office);
    const sg = getSalesGroupByName(leaf?.sales_group || targets[0].sales_group);
    if (sg) setSalesGroupCode(sg.code);
  }, [targets]);

  const models = useMemo(() => {
    if (!salesGroup || !officeName) return [];
    return buildOfficeModelTargets(targets, salesGroup.name, officeName);
  }, [targets, salesGroup, officeName]);

  const executives = useMemo(() => {
    if (!officeName) return [];
    return executivesByOffice[officeName] || [];
  }, [officeName, executivesByOffice]);

  useEffect(() => {
    if (!salesGroup || !officeName) return;
    const next = {};
    for (const exec of executives) {
      for (const m of models) {
        next[cellKey(exec.id, m.model)] = "";
      }
    }
    for (const row of existingAllocations) {
      if (row.sales_office !== officeName) continue;
      if (row.sales_group && row.sales_group !== salesGroup.name) continue;
      if (row.article_code) continue;
      const key = cellKey(String(row.sales_exec_code), row.model);
      if (key in next || executives.some((e) => e.id === String(row.sales_exec_code))) {
        next[key] = row.target_units > 0 ? String(row.target_units) : "";
      }
    }
    setValues(next);
    setError("");
    setMessage("");
  }, [salesGroup, officeName, models, executives, existingAllocations]);

  const status = useMemo(
    () =>
      computeExecAllocationStatus({
        values,
        models,
        executives,
      }),
    [values, models, executives]
  );

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/allocations?plan=${slug}`);
    }
  }

  function updateCell(key, raw) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  async function persist({ markComplete }) {
    if (!salesGroup || !officeName) {
      setError("Select a sales group and office.");
      return;
    }
    if (status.hasOver) {
      setError("Fix over-allocations before saving.");
      return;
    }
    if (markComplete && !status.isFullyAllocated) {
      setError("Every model must exactly match its office target before completion.");
      return;
    }

    if (markComplete) setCompleting(true);
    else setSaving(true);
    setError("");
    setMessage("");

    try {
      const rows = buildExecSavePayload({
        values,
        models,
        executives,
        salesGroup: salesGroup.name,
        salesOffice: officeName,
      });

      const res = await fetch("/api/plans/save-exec-grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: plan.id,
          salesGroup: salesGroup.name,
          salesOffice: officeName,
          rows,
          markComplete: Boolean(markComplete),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setMessage(
        markComplete
          ? "Sales executive allocation marked complete."
          : `Draft saved (${data.savedCount || 0} line${(data.savedCount || 0) === 1 ? "" : "s"}).`
      );
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
      setCompleting(false);
    }
  }

  const hasGrid = salesGroup && officeName && models.length > 0 && executives.length > 0;
  const selectedOffice = offices.find((o) => o.name === officeName);

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

        <div className="min-w-[200px] space-y-1">
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

        <div className="min-w-[220px] space-y-1">
          <Label className="text-xs text-slate-500">Sales Office</Label>
          <Select
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
            disabled={isLocked || officeLocked}
            className="h-9"
          >
            {offices.map((o) => (
              <option key={o.name} value={o.name}>
                {o.code ? `${o.code} — ` : ""}
                {getOfficeLabel(o)}
              </option>
            ))}
          </Select>
          {officeLocked && (
            <p className="text-[11px] text-slate-400">Restricted to your assigned office(s).</p>
          )}
        </div>

        {!isLocked && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => persist({ markComplete: false })}
              disabled={saving || completing || !hasGrid || status.hasOver}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save draft"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => persist({ markComplete: true })}
              disabled={
                completing || saving || !hasGrid || !status.isFullyAllocated || status.hasOver
              }
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {completing ? "Completing..." : "Mark Sales Executive Allocation Complete"}
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Distribute office model targets across sales executives. Office targets are fixed from
        Retail Head allocation. Row total = Full Month Target Qty.
      </p>

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {status.hasOver && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {status.modelStatuses
                .filter((m) => m.over)
                .map((m) => (
                  <p key={m.model} className="text-xs">
                    {m.model}: allocated {m.allocated} exceeds office target {m.target} (+
                    {m.allocated - m.target})
                  </p>
                ))}
            </div>
          </div>
        </div>
      )}

      {status.remainingModels.length > 0 && !status.hasOver && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Still remaining to allocate</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {status.remainingModels.map((m) => (
              <li key={m.model}>
                {m.model}: {m.allocated} of {m.target} allocated, {m.remaining} left
              </li>
            ))}
            <li className="pt-1 font-medium">
              Office total: {status.allocatedTotal} of {status.officeTotal} allocated,{" "}
              {status.remainingTotal} left
            </li>
          </ul>
        </div>
      )}

      {!offices.length && (
        <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No sales offices are assigned to your account.
        </div>
      )}

      {offices.length > 0 && !hasGrid && (
        <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            Nothing to allocate for {selectedOffice ? getOfficeLabel(selectedOffice) : "this office"}
          </p>
          <p className="mt-1">
            Retail Head must first allocate model targets to this office for{" "}
            <span className="font-medium">{salesGroup?.name}</span>.
          </p>
        </div>
      )}

      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-sky-100/80">
                <th
                  colSpan={2}
                  className="sticky left-0 z-20 border border-slate-300 bg-sky-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-700"
                >
                  {formatPeriod(plan.month, plan.year)} · {getOfficeLabel(selectedOffice)} · Sales
                  Executive Allocation
                </th>
                <th
                  colSpan={models.length + 1}
                  className="border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-700"
                >
                  Models
                </th>
              </tr>
              <tr className="bg-slate-100">
                <th className="sticky left-0 z-20 min-w-[5.5rem] border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-xs text-slate-500">
                  Sales Exec Code
                </th>
                <th className="sticky left-[5.5rem] z-20 min-w-[10rem] border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-xs text-slate-500">
                  Sales Executive Name
                </th>
                {models.map((m) => (
                  <th
                    key={`h-${m.model}`}
                    className="min-w-[4.5rem] border border-slate-300 px-1 py-1.5 text-center text-xs font-medium text-slate-700"
                  >
                    {m.model}
                  </th>
                ))}
                <th className="min-w-[5rem] border border-slate-300 px-1 py-1.5 text-center text-xs font-semibold text-slate-800">
                  Full Month Target Qty
                </th>
              </tr>
            </thead>
            <tbody>
              {executives.map((exec, rowIndex) => {
                const rowTotal = execRowTotal(values, models, exec.id);
                return (
                  <tr
                    key={exec.id}
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                  >
                    <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-2 py-1.5 font-mono text-xs text-slate-600">
                      {exec.id}
                    </td>
                    <td className="sticky left-[5.5rem] z-10 border border-slate-200 bg-inherit px-2 py-1.5 text-sm text-slate-900">
                      {exec.name}
                    </td>
                    {models.map((m) => {
                      const key = cellKey(exec.id, m.model);
                      const modelStatus = status.modelStatuses.find((s) => s.model === m.model);
                      return (
                        <td key={key} className="min-w-[4.5rem] border border-slate-200 p-0">
                          {isLocked ? (
                            <div className="flex h-8 items-center justify-center text-sm tabular-nums">
                              {values[key] || ""}
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              className={cn(
                                "h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50",
                                modelStatus?.over && "bg-red-50",
                                modelStatus &&
                                  modelStatus.remaining > 0 &&
                                  parseUnits(values[key]) > 0 &&
                                  !modelStatus.over &&
                                  "bg-amber-50/40"
                              )}
                              value={values[key] ?? ""}
                              onChange={(e) => updateCell(key, e.target.value)}
                              aria-label={`${exec.name} / ${m.model}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 bg-slate-50 px-1 text-center text-sm font-medium tabular-nums text-slate-800">
                      {rowTotal > 0 ? rowTotal : ""}
                    </td>
                  </tr>
                );
              })}

              <tr className="bg-slate-100 font-semibold">
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs"
                >
                  Allocated
                </td>
                {status.modelStatuses.map((m) => (
                  <td
                    key={`a-${m.model}`}
                    className={cn(
                      "border border-slate-300 px-1 py-1.5 text-center tabular-nums",
                      m.over && "bg-red-100 text-red-800",
                      !m.over && m.remaining > 0 && "bg-amber-50 text-amber-900",
                      m.complete && "bg-emerald-50 text-emerald-800"
                    )}
                  >
                    {m.allocated}
                  </td>
                ))}
                <td className="border border-slate-300 px-1 py-1.5 text-center tabular-nums">
                  {status.allocatedTotal}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-600"
                >
                  Office Target
                </td>
                {models.map((m) => (
                  <td
                    key={`t-${m.model}`}
                    className="border border-slate-300 px-1 py-1.5 text-center tabular-nums text-slate-700"
                  >
                    {m.officeTarget}
                  </td>
                ))}
                <td className="border border-slate-300 px-1 py-1.5 text-center tabular-nums text-slate-700">
                  {status.officeTotal}
                </td>
              </tr>
              <tr className="bg-white">
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
                >
                  Remaining
                </td>
                {status.modelStatuses.map((m) => (
                  <td
                    key={`r-${m.model}`}
                    className={cn(
                      "border border-slate-300 px-1 py-1.5 text-center tabular-nums",
                      m.over && "text-red-700",
                      m.remaining > 0 && !m.over && "text-amber-800",
                      m.complete && "text-emerald-700"
                    )}
                  >
                    {m.remaining}
                  </td>
                ))}
                <td
                  className={cn(
                    "border border-slate-300 px-1 py-1.5 text-center tabular-nums",
                    status.remainingTotal > 0 ? "text-amber-800" : "text-emerald-700"
                  )}
                >
                  {status.remainingTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
