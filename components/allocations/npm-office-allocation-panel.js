"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatPeriod } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getDivisionsForUser,
  getPrimarySalesGroups,
  getSalesOfficesForUser,
  getOfficeCode,
  getOfficeLabel,
} from "@/src/data";
import {
  dsBrandGroupTotal,
  expandOfficeAllocationsToModelLeaves,
  parseUnits,
  sumOfficeGroupUnits,
} from "@/lib/npm-allocation-rollup";
import { planSlug } from "@/lib/plans";
import { Save, AlertTriangle } from "lucide-react";

function cellKey(salesGroupName, officeName) {
  return `${salesGroupName}::${officeName}`;
}

/**
 * NPM Sales Office Allocation:
 * Month + Brand dropdowns → offices as rows, sales groups as columns.
 * Model/article detail is expanded proportionally on save for downstream BM use.
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

  const [divisionId, setDivisionId] = useState(() => divisions[0]?.id || "");
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const salesGroupColumns = useMemo(() => getPrimarySalesGroups(), []);
  const division = divisions.find((d) => d.id === divisionId) || divisions[0] || null;
  const offices = useMemo(
    () => (division ? getSalesOfficesForUser(user, division) : []),
    [user, division]
  );
  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);
  const isLocked = !editable;

  const displayGroups = salesGroupColumns;

  useEffect(() => {
    if (divisions.length === 0) return;
    if (!divisions.some((d) => d.id === divisionId)) {
      setDivisionId(divisions[0].id);
    }
  }, [divisions, divisionId]);

  useEffect(() => {
    if (!division) return;

    const next = {};
    for (const group of displayGroups) {
      for (const office of offices) {
        const units = sumOfficeGroupUnits(
          targets,
          division.name,
          group.name,
          office.name
        );
        next[cellKey(group.name, office.name)] = units > 0 ? String(units) : "";
      }
    }
    setValues(next);
    setError("");
    setMessage("");
  }, [division, displayGroups, offices, targets]);

  const dsByGroup = useMemo(() => {
    const map = {};
    if (!division) return map;
    for (const group of displayGroups) {
      map[group.name] = dsBrandGroupTotal(targets, division.name, group.name);
    }
    return map;
  }, [division, displayGroups, targets]);

  const columnAllocated = useMemo(() => {
    const map = {};
    for (const group of displayGroups) {
      map[group.name] = offices.reduce((sum, office) => {
        return sum + parseUnits(values[cellKey(group.name, office.name)]);
      }, 0);
    }
    return map;
  }, [displayGroups, offices, values]);

  const overGroups = useMemo(() => {
    return displayGroups.filter((g) => {
      const ds = dsByGroup[g.name] || 0;
      const allocated = columnAllocated[g.name] || 0;
      return ds > 0 && allocated > ds;
    });
  }, [displayGroups, dsByGroup, columnAllocated]);

  const grandDs = useMemo(
    () => Object.values(dsByGroup).reduce((s, v) => s + v, 0),
    [dsByGroup]
  );
  const grandAllocated = useMemo(
    () => Object.values(columnAllocated).reduce((s, v) => s + v, 0),
    [columnAllocated]
  );

  function rowTotal(officeName) {
    return displayGroups.reduce((sum, group) => {
      return sum + parseUnits(values[cellKey(group.name, officeName)]);
    }, 0);
  }

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/allocations?plan=${slug}`);
    }
  }

  function updateCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!division) {
      setError("Select a Division / Brand first.");
      return;
    }
    if (overGroups.length > 0) {
      setError(
        `Office totals exceed D&S targets for: ${overGroups.map((g) => g.name).join(", ")}.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const officeAllocations = [];
      for (const group of displayGroups) {
        const ds = dsByGroup[group.name] || 0;
        if (ds <= 0) continue;
        for (const office of offices) {
          officeAllocations.push({
            brand: division.name,
            sales_group: group.name,
            sales_office: office.name,
            target_units: parseUnits(values[cellKey(group.name, office.name)]),
          });
        }
      }

      if (officeAllocations.every((r) => !r.target_units)) {
        throw new Error("Enter at least one office allocation greater than 0 before saving.");
      }

      const models = expandOfficeAllocationsToModelLeaves({
        brand: division.name,
        officeAllocations,
        targets,
      });

      // Save one sales group at a time (API is group-scoped)
      const groupsToSave = [...new Set(models.map((m) => m.sales_group))];
      let savedCount = 0;

      for (const sg of groupsToSave) {
        const groupModels = models.filter((m) => m.sales_group === sg);
        const res = await fetch("/api/plans/save-npm-grid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodId: plan.id,
            salesGroup: sg,
            models: groupModels,
            articles: [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to save ${sg}`);
        savedCount += data.savedCount || 0;
      }

      setMessage(
        `Saved office allocation for ${division.name} (${savedCount} model line${
          savedCount === 1 ? "" : "s"
        }).`
      );
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save allocation");
    } finally {
      setSaving(false);
    }
  }

  const hasGrid = division && offices.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-[160px] space-y-1">
          <Label className="text-xs text-slate-500">Month</Label>
          <Select
            value={planPath}
            onChange={(e) => handleMonthChange(e.target.value)}
            disabled={isLocked}
            className="h-9"
          >
            {monthOptions.map((p) => (
              <option key={p.id} value={planSlug(p.month, p.year)}>
                {formatPeriod(p.month, p.year)}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs text-slate-500">Division / Brand</Label>
          <Select
            value={division?.id || ""}
            onChange={(e) => setDivisionId(e.target.value)}
            disabled={isLocked}
            className="h-9"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2 pb-0.5">
          {editable && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasGrid || overGroups.length > 0 || grandDs <= 0}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save Allocation"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Allocate the brand&apos;s D&amp;S targets across Sales Offices. Columns are sales groups;
        each column total should not exceed the D&amp;S target for that group. Model split is
        applied automatically for Branch Manager allocation.
      </p>

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      {overGroups.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Office totals exceed D&amp;S targets</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {overGroups.map((g) => (
                  <li key={g.code}>
                    {g.name}: allocated {(columnAllocated[g.name] || 0).toLocaleString()} vs D&amp;S{" "}
                    {(dsByGroup[g.name] || 0).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!hasGrid && (
        <p className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {divisions.length === 0
            ? "No divisions are available for your account."
            : "No sales offices are configured for this brand."}
        </p>
      )}

      {hasGrid && (
        <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-200/80">
                <th
                  rowSpan={3}
                  className="sticky left-0 z-20 min-w-[5rem] border border-slate-300 bg-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                >
                  Code
                </th>
                <th
                  rowSpan={3}
                  className="sticky left-[5rem] z-20 min-w-[11rem] border border-slate-300 bg-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                >
                  Sales Office
                </th>
                {displayGroups.map((group) => (
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
                {displayGroups.map((group) => (
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
                {displayGroups.map((group) => (
                  <th
                    key={`uom-${group.code}`}
                    className="border border-slate-300 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500"
                  >
                    EA
                    {(dsByGroup[group.name] || 0) > 0 && (
                      <span className="mt-0.5 block font-normal normal-case text-slate-400">
                        D&amp;S {(dsByGroup[group.name] || 0).toLocaleString()}
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
              {offices.map((office, rowIndex) => {
                const officeRowTotal = rowTotal(office.name);
                return (
                  <tr
                    key={office.name}
                    className={cn(rowIndex % 2 === 0 ? "bg-sky-50/50" : "bg-white")}
                  >
                    <td className="sticky left-0 z-10 border border-slate-200 bg-inherit px-2 py-1.5 font-mono text-xs text-slate-600">
                      {getOfficeCode(office)}
                    </td>
                    <td className="sticky left-[5rem] z-10 border border-slate-200 bg-inherit px-2 py-1.5 font-medium text-slate-900">
                      {getOfficeLabel(office)}
                    </td>
                    {displayGroups.map((group) => {
                      const key = cellKey(group.name, office.name);
                      const ds = dsByGroup[group.name] || 0;
                      const disabledGroup = ds <= 0;

                      return (
                        <td
                          key={`cell-${group.code}-${office.name}`}
                          className={cn(
                            "border border-slate-200 p-0",
                            disabledGroup && "bg-slate-50/80"
                          )}
                        >
                          {disabledGroup ? (
                            <div className="flex h-8 items-center justify-center text-slate-300">
                              —
                            </div>
                          ) : isLocked ? (
                            <div className="flex h-8 items-center justify-center px-1 text-sm tabular-nums text-slate-900">
                              {values[key] || ""}
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              className="h-8 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-amber-50"
                              value={values[key] ?? ""}
                              onChange={(e) => updateCell(key, e.target.value)}
                              aria-label={`${getOfficeLabel(office)} / ${group.name}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 bg-sky-50/60 px-2 py-1.5 text-center tabular-nums font-semibold text-slate-900">
                      {officeRowTotal > 0 ? officeRowTotal.toLocaleString() : ""}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-amber-100 font-semibold">
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border border-slate-300 bg-amber-100 px-3 py-2 text-xs uppercase tracking-wide text-slate-800"
                >
                  Overall Result
                </td>
                {displayGroups.map((group) => {
                  const allocated = columnAllocated[group.name] || 0;
                  const ds = dsByGroup[group.name] || 0;
                  const over = ds > 0 && allocated > ds;
                  return (
                    <td
                      key={`tot-${group.code}`}
                      className={cn(
                        "border border-slate-300 px-2 py-2 text-center tabular-nums",
                        over ? "text-red-700" : "text-slate-900"
                      )}
                    >
                      {allocated > 0 ? allocated.toLocaleString() : ""}
                      {ds > 0 && (
                        <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                          / {ds.toLocaleString()}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="border border-slate-300 bg-amber-200/80 px-2 py-2 text-center tabular-nums text-slate-900">
                  {grandAllocated > 0 ? grandAllocated.toLocaleString() : ""}
                  {grandDs > 0 && (
                    <span className="mt-0.5 block text-[10px] font-normal text-slate-600">
                      / {grandDs.toLocaleString()}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
