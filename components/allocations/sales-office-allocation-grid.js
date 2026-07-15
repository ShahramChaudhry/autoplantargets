"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSalesOffices, getOfficeLabel } from "@/src/data";
import { Save, AlertTriangle } from "lucide-react";

/**
 * National Performance Manager / Retail Head grid:
 * allocate the Retail brand+model target pool across Sales Offices.
 */
export function SalesOfficeAllocationGrid({
  planId,
  retailTotal,
  existingAllocations = [],
  editable = true,
}) {
  const router = useRouter();
  const offices = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const division of ["Toyota", "Honda"]) {
      for (const office of getSalesOffices(division)) {
        if (seen.has(office.name)) continue;
        seen.add(office.name);
        list.push({ ...office, division });
      }
    }
    return list;
  }, []);

  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const map = {};
    const ids = {};
    for (const row of existingAllocations) {
      map[row.sales_office] = String(row.units ?? "");
      ids[row.sales_office] = row.id;
    }
    setValues(map);
    setRecordIds(ids);
  }, [existingAllocations]);

  const allocated = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
    [values]
  );
  const remaining = retailTotal - allocated;
  const overAllocated = allocated > retailTotal;

  function updateCell(officeName, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [officeName]: value }));
  }

  async function handleSave() {
    if (overAllocated) {
      setError(
        `Allocated ${allocated.toLocaleString()} exceeds Retail target ${retailTotal.toLocaleString()}.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const nextIds = { ...recordIds };

      for (const office of offices) {
        const raw = values[office.name];
        const units = raw === "" || raw === undefined ? 0 : parseInt(raw, 10);
        if (Number.isNaN(units) || units < 0) {
          throw new Error(`Invalid units for ${office.label}`);
        }

        const existingId = nextIds[office.name];

        if (existingId) {
          if (units <= 0) {
            const res = await fetch(
              `/api/allocations?type=offices&id=${existingId}&periodId=${planId}`,
              { method: "DELETE" }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to delete allocation");
            delete nextIds[office.name];
            continue;
          }

          const res = await fetch("/api/allocations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "offices",
              id: existingId,
              periodId: planId,
              data: { units },
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to update allocation");
        } else if (units > 0) {
          const res = await fetch("/api/allocations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "offices",
              periodId: planId,
              data: {
                planning_period_id: planId,
                sales_office: office.name,
                units,
              },
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to save allocation");
          if (data.data?.id) nextIds[office.name] = data.data.id;
        }
      }

      setRecordIds(nextIds);
      setMessage("Sales office allocations saved.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save allocations");
    } finally {
      setSaving(false);
    }
  }

  // Group display by division for readability
  const byDivision = useMemo(() => {
    const groups = { Toyota: [], Honda: [] };
    for (const office of offices) {
      (groups[office.division] || (groups[office.division] = [])).push(office);
    }
    return groups;
  }, [offices]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Retail target (from D&amp;S)</p>
            <p className="text-lg font-bold tabular-nums">{retailTotal.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Allocated to offices</p>
            <p className="text-lg font-bold tabular-nums">{allocated.toLocaleString()}</p>
          </div>
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              remaining === 0
                ? "bg-emerald-50"
                : overAllocated
                  ? "bg-red-50"
                  : "bg-amber-50"
            )}
          >
            <p className="text-xs text-slate-500">Remaining</p>
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                overAllocated ? "text-red-700" : remaining === 0 ? "text-emerald-700" : "text-amber-800"
              )}
            >
              {remaining.toLocaleString()}
            </p>
          </div>
        </div>

        {editable && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || overAllocated}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save allocations"}
          </Button>
        )}
      </div>

      {overAllocated && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Office allocations cannot exceed the Retail target set by Demand &amp; Supply.
        </div>
      )}

      {(error || message) && (
        <p className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>
          {error || message}
        </p>
      )}

      <div className="overflow-auto border border-slate-300 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Division
              </th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Code
              </th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Sales Office
              </th>
              <th className="border border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                Units
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byDivision).map(([division, divisionOffices]) =>
              divisionOffices.map((office, idx) => (
                <tr
                  key={office.name}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                >
                  <td className="border border-slate-200 px-3 py-1.5 font-medium text-slate-800">
                    {idx === 0 ? division : ""}
                  </td>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-600">
                    {office.code}
                  </td>
                  <td className="border border-slate-200 px-3 py-1.5 text-slate-900">
                    {getOfficeLabel(office)}
                  </td>
                  <td className="border border-slate-200 p-0">
                    {editable ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        className="h-9 w-full bg-transparent px-2 text-center text-sm tabular-nums outline-none focus:bg-amber-50"
                        value={values[office.name] ?? ""}
                        onChange={(e) => updateCell(office.name, e.target.value)}
                        aria-label={`${office.label} units`}
                      />
                    ) : (
                      <div className="flex h-9 items-center justify-center tabular-nums">
                        {values[office.name] || ""}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
            <tr className="bg-slate-100 font-semibold">
              <td colSpan={3} className="border border-slate-300 px-3 py-2 text-xs uppercase tracking-wide text-slate-600">
                Total allocated
              </td>
              <td className="border border-slate-300 px-2 py-2 text-center tabular-nums">
                {allocated > 0 ? allocated.toLocaleString() : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
