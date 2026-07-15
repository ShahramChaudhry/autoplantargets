"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatPeriod } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDivisions,
  getSalesGroups,
  getSalesOffices,
  getSalesExecutives,
  getDivisionById,
  getSalesGroupByCode,
  buildTargetGridRows,
} from "@/src/data";
import { planLabel, planSlug, planStepPath } from "@/lib/plans";
import { Save, ArrowRight, Grid3X3 } from "lucide-react";

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

export function TargetEntryPanel({ plan, targets, periods = [], editable = true }) {
  const router = useRouter();
  const divisions = useMemo(() => getDivisions(), []);

  const [divisionId, setDivisionId] = useState(divisions[0]?.id || "");
  const [salesGroupCode, setSalesGroupCode] = useState("");
  const [salesOffice, setSalesOffice] = useState("");
  const [salesExecutiveId, setSalesExecutiveId] = useState("");
  const [gridActive, setGridActive] = useState(false);
  const [rows, setRows] = useState([]);
  const [values, setValues] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const division = getDivisionById(divisionId);
  const salesGroups = useMemo(
    () => (division ? getSalesGroups(division) : []),
    [division]
  );
  const salesGroup = getSalesGroupByCode(salesGroupCode);
  const officeOptions = useMemo(
    () => (division ? getSalesOffices(division) : []),
    [division]
  );
  const executiveOptions = useMemo(
    () => (division && salesOffice ? getSalesExecutives(division, salesOffice) : []),
    [division, salesOffice]
  );
  const selectedExecutive = executiveOptions.find((e) => e.id === salesExecutiveId) || null;

  const monthOptions = periods.length > 0 ? periods : [plan];
  const planPath = planSlug(plan.month, plan.year);

  useEffect(() => {
    if (salesGroups.length > 0 && !salesGroups.some((g) => g.code === salesGroupCode)) {
      setSalesGroupCode(salesGroups[0].code);
      setGridActive(false);
      setRows([]);
    }
  }, [salesGroups, salesGroupCode]);

  useEffect(() => {
    if (officeOptions.length === 0) {
      setSalesOffice("");
      setSalesExecutiveId("");
      return;
    }
    if (!officeOptions.includes(salesOffice)) {
      setSalesOffice(officeOptions[0]);
      setSalesExecutiveId("");
      setGridActive(false);
      setRows([]);
    }
  }, [officeOptions, salesOffice]);

  useEffect(() => {
    if (executiveOptions.length === 0) {
      setSalesExecutiveId("");
      return;
    }
    if (!executiveOptions.some((e) => e.id === salesExecutiveId)) {
      setSalesExecutiveId(executiveOptions[0].id);
    }
  }, [executiveOptions, salesExecutiveId]);

  const total = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
    [values]
  );

  const showSalesOfficeColumn = rows.some((r) => r.includeSalesOffice);

  function resetGrid() {
    setGridActive(false);
    setRows([]);
    setValues({});
    setRecordIds({});
    setMessage("");
    setError("");
  }

  function handleDivisionChange(id) {
    setDivisionId(id);
    setSalesOffice("");
    setSalesExecutiveId("");
    resetGrid();
  }

  function handleSalesGroupChange(code) {
    setSalesGroupCode(code);
    resetGrid();
  }

  function handleSalesOfficeChange(office) {
    setSalesOffice(office);
    setSalesExecutiveId("");
    resetGrid();
  }

  function handleSalesExecutiveChange(id) {
    setSalesExecutiveId(id);
    resetGrid();
  }

  function handleMonthChange(slug) {
    if (slug && slug !== planPath) {
      router.push(`/targets?plan=${slug}`);
    }
  }

  function generateGrid() {
    if (!division || !salesGroup) {
      setError("Select Division and Sales Group before generating the grid.");
      return;
    }
    if (!salesOffice) {
      setError("Select a Sales Office before generating the grid.");
      return;
    }
    if (!salesExecutiveId) {
      setError("Select a Sales Executive before generating the grid.");
      return;
    }

    const nextRows = buildTargetGridRows(division, salesGroup, salesOffice);
    if (nextRows.length === 0) {
      setError("No models configured for this Division and Sales Group.");
      setGridActive(false);
      setRows([]);
      return;
    }

    const nextValues = {};
    const nextIds = {};

    for (const row of nextRows) {
      const existing = findExistingTarget(
        targets,
        division.name,
        salesGroup.name,
        row.model,
        row.salesOffice
      );
      nextValues[row.key] = existing ? String(existing.target_units) : "";
      if (existing) nextIds[row.key] = existing.id;
    }

    setRows(nextRows);
    setValues(nextValues);
    setRecordIds(nextIds);
    setGridActive(true);
    setError("");
    setMessage("");
  }

  function updateCell(key, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function saveRow(row, units) {
    const existingId = recordIds[row.key];
    const payload = {
      planning_period_id: plan.id,
      brand: division.name,
      sales_group: salesGroup.name,
      model: row.model,
      sales_office: row.salesOffice || salesOffice || null,
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
    if (!division || !salesGroup || !gridActive) {
      setError("Generate the grid before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const nextIds = { ...recordIds };

      for (const row of rows) {
        const raw = values[row.key];
        const units = raw === "" || raw === undefined ? 0 : parseInt(raw, 10);
        if (Number.isNaN(units) || units < 0) {
          throw new Error(`Invalid target for ${row.model}`);
        }

        if (!nextIds[row.key] && units === 0) continue;

        const id = await saveRow(row, units);
        if (id) nextIds[row.key] = id;
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

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-4">
          <p className="text-sm text-slate-500">Selected Plan</p>
          <p className="text-lg font-semibold text-slate-900">{planLabel(plan.month, plan.year)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Entry</CardTitle>
          <p className="text-sm text-slate-500">
            Select Division, Month, Sales Group, Sales Office, and Sales Executive, then generate
            the target grid.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="space-y-2">
              <Label>Division</Label>
              <Select
                value={divisionId}
                onChange={(e) => handleDivisionChange(e.target.value)}
                disabled={!editable}
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                value={planPath}
                onChange={(e) => handleMonthChange(e.target.value)}
              >
                {monthOptions.map((p) => (
                  <option key={p.id} value={planSlug(p.month, p.year)}>
                    {formatPeriod(p.month, p.year)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Sales Group</Label>
              <Select
                value={salesGroupCode}
                onChange={(e) => handleSalesGroupChange(e.target.value)}
                disabled={!editable || salesGroups.length === 0}
              >
                {salesGroups.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} — {g.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label>Sales Office</Label>
              <Select
                value={salesOffice}
                onChange={(e) => handleSalesOfficeChange(e.target.value)}
                disabled={!editable || officeOptions.length === 0}
              >
                {officeOptions.length === 0 && <option value="">No offices</option>}
                {officeOptions.map((office) => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Sales Executive</Label>
              <Select
                value={salesExecutiveId}
                onChange={(e) => handleSalesExecutiveChange(e.target.value)}
                disabled={!editable || executiveOptions.length === 0}
              >
                {executiveOptions.length === 0 && <option value="">Select office first</option>}
                {executiveOptions.map((exec) => (
                  <option key={exec.id} value={exec.id}>
                    {exec.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {editable && (
            <div className="flex justify-end">
              <Button type="button" onClick={generateGrid} className="gap-2">
                <Grid3X3 className="h-4 w-4" />
                Generate Grid
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </CardContent>
      </Card>

      {gridActive && (
        <Card>
          <CardHeader>
            <CardTitle>
              {division?.name} · {salesGroup?.name} · {salesOffice}
            </CardTitle>
            <p className="text-sm text-slate-500">
              {selectedExecutive
                ? `Sales Executive: ${selectedExecutive.name}`
                : null}
              {selectedExecutive && showSalesOfficeColumn ? " · " : null}
              {showSalesOfficeColumn
                ? "Rows are models for the selected sales office."
                : "Rows are generated as Models from master data."}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Model</th>
                    {showSalesOfficeColumn && (
                      <th className="px-4 py-3">Sales Office</th>
                    )}
                    <th className="px-4 py-3 text-right">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.key} className="bg-white">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.model}</td>
                      {showSalesOfficeColumn && (
                        <td className="px-4 py-3 text-slate-600">
                          {row.salesOffice || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          min="0"
                          className="ml-auto h-9 w-28 text-right"
                          value={values[row.key] ?? ""}
                          onChange={(e) => updateCell(row.key, e.target.value)}
                          disabled={!editable}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!gridActive && targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Division</th>
                    <th className="px-4 py-3">Sales Group</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Sales Office</th>
                    <th className="px-4 py-3 text-right">Target Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targets.map((target) => (
                    <tr key={target.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-slate-900">{target.brand}</td>
                      <td className="px-4 py-3 text-slate-600">{target.sales_group}</td>
                      <td className="px-4 py-3 text-slate-600">{target.model || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{target.sales_office || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {target.target_units.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Select the matching Division, Sales Group, and Sales Office, then Generate Grid to edit.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm text-slate-500">
            {gridActive ? "Grid Total Units" : "Saved Total Units"}
          </p>
          <p className="text-2xl font-bold text-slate-900">
            {(gridActive ? total : targets.reduce((s, t) => s + t.target_units, 0)).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && gridActive && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          )}
          <Link
            href={planStepPath("/model-allocations", plan.month, plan.year)}
            className={cn(
              buttonVariants(),
              "gap-2",
              targets.length === 0 && !gridActive && "pointer-events-none opacity-50"
            )}
            aria-disabled={targets.length === 0 && !gridActive}
          >
            Continue to Model Allocation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
