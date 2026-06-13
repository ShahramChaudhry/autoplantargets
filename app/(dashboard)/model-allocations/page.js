import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelector } from "@/components/period-selector";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { AllocationEditor } from "@/components/allocation-editor";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { MODELS } from "@/lib/constants";
import { Suspense } from "react";

export default async function ModelAllocationsPage({ searchParams }) {
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: targets } = period
    ? await supabase.from("targets").select("*").eq("planning_period_id", period.id)
    : { data: [] };

  const targetIds = (targets || []).map((t) => t.id);

  const { data: allocations } = targetIds.length
    ? await supabase
        .from("model_allocations")
        .select("*, targets(brand, sales_group)")
        .in("target_id", targetIds)
        .order("model")
    : { data: [] };

  const targetOptions = (targets || []).map((t) => ({
    value: t.id,
    label: `${t.brand} — ${t.sales_group} (${t.target_units} units)`,
  }));

  const total = (allocations || []).reduce((s, a) => s + a.units, 0);

  return (
    <>
      <Header
        title="Model Allocation"
        description="Step 2: Allocate targets to vehicle models"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && targetOptions.length > 0 && (
        <AddAllocationForm
          type="models"
          periodId={period.id}
          options={{ targets: targetOptions, models: MODELS }}
          fields={[
            { name: "target_id", label: "Target", type: "select", optionsKey: "targets" },
            { name: "model", label: "Model", type: "select", optionsKey: "models" },
            { name: "units", label: "Units", type: "number" },
          ]}
        />
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Model Allocations ({total} total units)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Sales Group</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allocations || []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.targets?.brand}</TableCell>
                  <TableCell>{a.targets?.sales_group}</TableCell>
                  <TableCell className="font-medium">{a.model}</TableCell>
                  <TableCell>{a.units}</TableCell>
                  <TableCell>
                    <AllocationEditor
                      type="models"
                      id={a.id}
                      field="units"
                      value={a.units}
                      periodId={period?.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
