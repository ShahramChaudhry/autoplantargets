import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelector } from "@/components/period-selector";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { AllocationEditor } from "@/components/allocation-editor";
import { WorkflowActions } from "@/components/workflow-actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { SALES_OFFICES } from "@/lib/constants";
import { Suspense } from "react";

export default async function RetailAllocationsPage({ searchParams }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: offices } = period
    ? await supabase
        .from("sales_office_allocations")
        .select("*")
        .eq("planning_period_id", period.id)
        .order("sales_office")
    : { data: [] };

  const { data: retailTargets } = period
    ? await supabase
        .from("targets")
        .select("target_units")
        .eq("planning_period_id", period.id)
        .eq("sales_group", "Retail")
    : { data: [] };

  const retailTotal = (retailTargets || []).reduce((s, t) => s + t.target_units, 0);
  const officeTotal = (offices || []).reduce((s, o) => s + o.units, 0);

  return (
    <>
      <Header
        title="Sales Office Allocation"
        description="Step 9: Allocate Retail targets to Sales Offices"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && (
        <>
          <div className="mb-4 flex gap-4 text-sm">
            <span className="rounded-lg bg-blue-50 px-3 py-1 text-blue-800">
              Retail Target: {retailTotal} units
            </span>
            <span className={`rounded-lg px-3 py-1 ${officeTotal === retailTotal ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              Allocated: {officeTotal} units
            </span>
          </div>

          <AddAllocationForm
            type="offices"
            periodId={period.id}
            options={{ offices: SALES_OFFICES }}
            fields={[
              { name: "planning_period_id", default: period.id },
              { name: "sales_office", label: "Sales Office", type: "select", optionsKey: "offices" },
              { name: "units", label: "Units", type: "number" },
            ]}
          />

          <WorkflowActions periodId={period.id} status={period.status} role={user.role} />

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sales Office Allocations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sales Office</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(offices || []).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.sales_office}</TableCell>
                      <TableCell>{o.units}</TableCell>
                      <TableCell>
                        <AllocationEditor
                          type="offices"
                          id={o.id}
                          field="units"
                          value={o.units}
                          periodId={period.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
