import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelector } from "@/components/period-selector";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { AllocationEditor } from "@/components/allocation-editor";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { BRANDS, SALES_GROUPS } from "@/lib/constants";
import { Suspense } from "react";

export default async function TargetsPage({ searchParams }) {
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: targets } = period
    ? await supabase
        .from("targets")
        .select("*")
        .eq("planning_period_id", period.id)
        .order("brand")
    : { data: [] };

  const total = (targets || []).reduce((s, t) => s + t.target_units, 0);

  return (
    <>
      <Header
        title="Brand & Sales Group Targets"
        description="Step 1: Create monthly targets by Brand and Sales Group"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && (
        <AddAllocationForm
          type="targets"
          periodId={period.id}
          options={{ brands: BRANDS, salesGroups: SALES_GROUPS }}
          fields={[
            { name: "planning_period_id", default: period.id },
            { name: "brand", label: "Brand", type: "select", optionsKey: "brands" },
            { name: "sales_group", label: "Sales Group", type: "select", optionsKey: "salesGroups" },
            { name: "target_units", label: "Target Units", type: "number" },
          ]}
        />
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Targets ({total} total units)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Sales Group</TableHead>
                <TableHead>Target Units</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(targets || []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.brand}</TableCell>
                  <TableCell>{t.sales_group}</TableCell>
                  <TableCell>{t.target_units}</TableCell>
                  <TableCell>
                    <AllocationEditor
                      type="targets"
                      id={t.id}
                      field="target_units"
                      value={t.target_units}
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
