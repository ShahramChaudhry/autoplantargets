"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn, formatPeriod } from "@/lib/utils";
import {
  getPrimarySalesGroups,
  getOfficeLabel,
} from "@/src/data";
import {
  computeExecGroupAllocationStatus,
  expandExecGroupAllocationsToModelLeaves,
  groupCellKey,
  officeGroupTarget,
  parseUnits,
  sumExecGroupUnits,
} from "@/lib/exec-allocation-rollup";
import { planSlug } from "@/lib/plans";
import { Save, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Branch Manager grid: Sales Executive × Sales Group for one office.
 * Model detail is expanded on save from NPM office leaves.
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
  const [officeName, setOfficeName] = useState(
    () => defaultOfficeName || offices[0]?.name || ""
  );
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const salesGroupColumns = useMemo(() => getPrimarySalesGroups(), []);
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

  const executives = useMemo(() => {
    if (!officeName) return [];
    return executivesByOffice[officeName] || [];
  }, [officeName, executivesByOffice]);

  const officeTargetsByGroup = useMemo(() => {
    const map = {};
    for (const group of salesGroupColumns) {
      map[group.name] = officeName
        ? officeGroupTarget(targets, group.name, officeName)
        : 0;
    }
    return map;
  }, [salesGroupColumns, targets, officeName]);

  const grandOfficeTarget = useMemo(
    () => Object.values(officeTargetsByGroup).reduce((s, v) => s + v, 0),
    [officeTargetsByGroup]
  );

  useEffect(() => {
    if (!officeName) return;
    const next = {};
    for (const group of salesGroupColumns) {
      for (const exec of executives) {
        const units = sumExecGroupUnits(
          existingAllocations,
          group.name,
          officeName,
          exec.id
        );
        next[groupCellKey(group.name, exec.id)] = units > 0 ? String(units) : "";
      }
    }
    setValues(next);
    setError("");
    setMessage("");
  }, [officeName, salesGroupColumns, executives, existingAllocations]);

  const status = useMemo(
    () =>
      computeExecGroupAllocationStatus({
        values,
        salesGroups: salesGroupColumns,
        executives,
        officeTargetsByGroup,
      }),
    [values, salesGroupColumns, executives, officeTargetsByGroup]
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

  function execRowTotal(execCode) {
    return salesGroupColumns.reduce((sum, group) => {
      return sum + parseUnits(values[groupCellKey(group.name, execCode)]);
    }, 0);
  }

  async function persist({ markComplete }) {
    if (!officeName) {
      setError("Select a sales office.");
      return;
    }
    if (status.hasOver) {
      setError("Fix over-allocations before saving.");
      return;
    }
    if (markComplete && !status.isFullyAllocated) {
      setError(
        "Every sales group must exactly match its office target before completion."
      );
      return;
    }

    if (markComplete) setCompleting(true);
    else setSaving(true);
    setError("");
    setMessage("");

    try {
      const groupsToSave = salesGroupColumns.filter(
        (g) => (officeTargetsByGroup[g.name] || 0) > 0
      );
      if (groupsToSave.length === 0) {
        throw new Error(
          "No office targets found for this sales office. Retail Head must allocate first."
        );
      }

      let savedCount = 0;
      let lastResponse = null;
      for (let i = 0; i < groupsToSave.length; i++) {
        const group = groupsToSave[i];
        const rows = expandExecGroupAllocationsToModelLeaves({
          values,
          executives,
          salesGroupName: group.name,
          salesOffice: officeName,
          targets,
          existingAllocations,
        });

        const isLast = i === groupsToSave.length - 1;
        const res = await fetch("/api/plans/save-exec-grid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodId: plan.id,
            salesGroup: group.name,
            salesOffice: officeName,
            rows,
            markComplete: Boolean(markComplete) && isLast,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to save ${group.name}`);
        savedCount += data.savedCount || 0;
        lastResponse = data;
      }

      if (markComplete) {
        const recon = lastResponse?.reconciliation;
        if (recon?.passed && lastResponse?.planStatus === "completed") {
          setMessage(
            `Allocation complete and reconciled. D&S ${recon.dsSum} = Office ${recon.npmSum} = Exec ${recon.execSum}. Plan marked Completed.`
          );
        } else if (recon && !recon.allOfficesComplete) {
          setMessage(
            `This office is fully allocated. Waiting on other offices before reconciliation: ${(recon.incompleteOffices || []).join(", ") || "—"}.`
          );
        } else if (lastResponse?.planStatus === "reconciliation_failed") {
          setMessage(
            `Reconciliation failed: D&S ${recon?.dsSum} vs Office ${recon?.npmSum} vs Exec ${recon?.execSum}. Correct allocations and mark complete again.`
          );
        } else {
          setMessage("Sales executive allocation marked complete.");
        }
      } else {
        setMessage(
          `Draft saved (${savedCount} line${savedCount === 1 ? "" : "s"}).`
        );
      }
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
      setCompleting(false);
    }
  }

  const hasGrid = officeName && executives.length > 0;
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
            <p className="text-[11px] text-slate-400">
              Restricted to your assigned office(s).
            </p>
          )}
        </div>

        {!isLocked && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => persist({ markComplete: false })}
              disabled={
                saving || completing || !hasGrid || status.hasOver || grandOfficeTarget <= 0
              }
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
                completing ||
                saving ||
                !hasGrid ||
                !status.isFullyAllocated ||
                status.hasOver
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
        Distribute office targets across sales executives by sales group. Office targets come
        from Retail Head allocation. Model split is applied automatically on save.
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
              {status.groupStatuses
                .filter((g) => g.over)
                .map((g) => (
                  <p key={g.salesGroup} className="text-xs">
                    {g.salesGroup}: allocated {g.allocated} exceeds office target {g.target} (+
                    {g.allocated - g.target})
                  </p>
                ))}
            </div>
          </div>
        </div>
      )}

      {status.remainingGroups.length > 0 && !status.hasOver && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Still remaining to allocate</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {status.remainingGroups.map((g) => (
              <li key={g.salesGroup}>
                {g.salesGroup}: {g.allocated} of {g.target} allocated, {g.remaining} left
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
          No sales offices are configured for Branch Manager allocation.
        </div>
      )}

      {offices.length > 0 && hasGrid && grandOfficeTarget <= 0 && (
        <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            Nothing to allocate for{" "}
            {selectedOffice ? getOfficeLabel(selectedOffice) : "this office"}
          </p>
          <p className="mt-1">
            Retail Head must first allocate targets to this office across sales groups.
          </p>
        </div>
      )}

      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-200/80">
                <th
                  rowSpan={3}
                  className="sticky left-0 z-20 min-w-[5.5rem] border border-slate-300 bg-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                >
                  Sales Exec Code
                </th>
                <th
                  rowSpan={3}
                  className="sticky left-[5.5rem] z-20 min-w-[11rem] border border-slate-300 bg-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                >
                  Sales Executive Name
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
                    {(officeTargetsByGroup[group.name] || 0) > 0 && (
                      <span className="mt-0.5 block font-normal normal-case text-slate-400">
                        Office {(officeTargetsByGroup[group.name] || 0).toLocaleString()}
                      </span>
                    )}
                  </th>
                ))}
                <th className="border border-slate-300 bg-sky-50 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  EA
                </th>
              </tr>
            </thead>
            <tbody>
              {executives.map((exec, rowIndex) => {
                const rowTotal = execRowTotal(exec.id);
                return (
                  <tr
                    key={exec.id}
                    className={cn(rowIndex % 2 === 0 ? "bg-sky-50/50" : "bg-white")}
                  >
                    <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-2 py-1.5 font-mono text-xs text-slate-600">
                      {exec.id}
                    </td>
                    <td className="sticky left-[5.5rem] z-10 border border-slate-200 bg-inherit px-2 py-1.5 text-sm text-slate-900">
                      {exec.name}
                    </td>
                    {salesGroupColumns.map((group) => {
                      const key = groupCellKey(group.name, exec.id);
                      const groupStatus = status.groupStatuses.find(
                        (g) => g.salesGroup === group.name
                      );
                      const inactive = (officeTargetsByGroup[group.name] || 0) <= 0;

                      return (
                        <td
                          key={key}
                          className={cn(
                            "border border-slate-200 p-0",
                            inactive && "bg-slate-50/80"
                          )}
                        >
                          {inactive ? (
                            <div className="flex h-8 items-center justify-center text-slate-300">
                              —
                            </div>
                          ) : isLocked ? (
                            <div className="flex h-8 items-center justify-center text-sm tabular-nums">
                              {values[key] || ""}
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              className={cn(
                                "h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50",
                                groupStatus?.over && "bg-red-50",
                                groupStatus &&
                                  groupStatus.remaining > 0 &&
                                  parseUnits(values[key]) > 0 &&
                                  !groupStatus.over &&
                                  "bg-amber-50/40"
                              )}
                              value={values[key] ?? ""}
                              onChange={(e) => updateCell(key, e.target.value)}
                              aria-label={`${exec.name} / ${group.name}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 bg-sky-50/60 px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-slate-900">
                      {rowTotal > 0 ? rowTotal.toLocaleString() : ""}
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
                {status.groupStatuses.map((g) => (
                  <td
                    key={`a-${g.salesGroup}`}
                    className={cn(
                      "border border-slate-300 px-1 py-1.5 text-center tabular-nums",
                      g.inactive && "text-slate-300",
                      g.over && "bg-red-100 text-red-800",
                      !g.inactive && !g.over && g.remaining > 0 && "bg-amber-50 text-amber-900",
                      g.complete && "bg-emerald-50 text-emerald-800"
                    )}
                  >
                    {g.inactive ? "" : g.allocated}
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
                {salesGroupColumns.map((group) => (
                  <td
                    key={`t-${group.code}`}
                    className="border border-slate-300 px-1 py-1.5 text-center tabular-nums text-slate-700"
                  >
                    {(officeTargetsByGroup[group.name] || 0) > 0
                      ? officeTargetsByGroup[group.name]
                      : ""}
                  </td>
                ))}
                <td className="border border-slate-300 px-1 py-1.5 text-center tabular-nums text-slate-700">
                  {status.officeTotal > 0 ? status.officeTotal : ""}
                </td>
              </tr>
              <tr className="bg-amber-100 font-semibold">
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border border-slate-300 bg-amber-100 px-2 py-1.5 text-xs uppercase tracking-wide text-slate-800"
                >
                  Remaining
                </td>
                {status.groupStatuses.map((g) => (
                  <td
                    key={`r-${g.salesGroup}`}
                    className={cn(
                      "border border-slate-300 px-1 py-1.5 text-center tabular-nums",
                      g.inactive && "text-slate-300",
                      g.over && "text-red-700",
                      g.remaining > 0 && !g.over && "text-amber-800",
                      g.complete && "text-emerald-700"
                    )}
                  >
                    {g.inactive ? "" : g.remaining}
                  </td>
                ))}
                <td
                  className={cn(
                    "border border-slate-300 bg-amber-200/70 px-1 py-1.5 text-center tabular-nums",
                    status.remainingTotal > 0 ? "text-amber-900" : "text-emerald-800"
                  )}
                >
                  {status.officeTotal > 0 ? status.remainingTotal : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
