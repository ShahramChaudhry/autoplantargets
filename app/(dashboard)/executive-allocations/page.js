import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelector } from "@/components/period-selector";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { AllocationEditor } from "@/components/allocation-editor";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { SALES_EXECUTIVES } from "@/lib/constants";
import { Suspense } from "react";

export default async function ExecutiveAllocationsPage({ searchParams }) {
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: offices } = period
    ? await supabase
        .from("sales_office_allocations")
        .select("*")
        .eq("planning_period_id", period.id)
    : { data: [] };

  const officeIds = (offices || []).map((o) => o.id);

  const { data: executives } = officeIds.length
    ? await supabase
        .from("executive_allocations")
        .select("*, sales_office_allocations(sales_office, units)")
        .in("sales_office_allocation_id", officeIds)
    : { data: [] };

  const officeOptions = (offices || []).map((o) => ({
    value: o.id,
    label: `${o.sales_office} (${o.units} units)`,
  }));

  const execTotal = (executives || []).reduce((s, e) => s + e.units, 0);
  const officeTotal = (offices || []).reduce((s, o) => s + o.units, 0);

  return (
    <>
      <Header
        title="Executive Allocation"
        description="Step 10: Allocate Sales Office targets to Sales Executives"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && officeOptions.length > 0 && (
        <>
          <div className="mb-4 flex gap-4 text-sm">
            <span className="rounded-lg bg-blue-50 px-3 py-1 text-blue-800">
              Office Total: {officeTotal} units
            </span>
            <span className={`rounded-lg px-3 py-1 ${execTotal === officeTotal ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              Executive Total: {execTotal} units
            </span>
          </div>

          <AddAllocationForm
            type="executives"
            periodId={period.id}
            options={{ offices: officeOptions, executives: SALES_EXECUTIVES }}
            fields={[
              { name: "sales_office_allocation_id", label: "Sales Office", type: "select", optionsKey: "offices" },
              { name: "sales_executive", label: "Sales Executive", type: "select", optionsKey: "executives" },
              { name: "units", label: "Units", type: "number" },
            ]}
          />

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Executive Allocations by Office</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sales Office</TableHead>
                    <TableHead>Sales Executive</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(executives || []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.sales_office_allocations?.sales_office}</TableCell>
                      <TableCell className="font-medium">{e.sales_executive}</TableCell>
                      <TableCell>{e.units}</TableCell>
                      <TableCell>
                        <AllocationEditor
                          type="executives"
                          id={e.id}
                          field="units"
                          value={e.units}
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
