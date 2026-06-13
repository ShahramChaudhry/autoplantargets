import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelector } from "@/components/period-selector";
import { AddAllocationForm } from "@/components/add-allocation-form";
import { AllocationEditor } from "@/components/allocation-editor";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { Suspense } from "react";

export default async function ArticleAllocationsPage({ searchParams }) {
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: targets } = period
    ? await supabase.from("targets").select("id").eq("planning_period_id", period.id)
    : { data: [] };

  const targetIds = (targets || []).map((t) => t.id);

  const { data: models } = targetIds.length
    ? await supabase
        .from("model_allocations")
        .select("id, model, units, targets(brand, sales_group)")
        .in("target_id", targetIds)
    : { data: [] };

  const modelIds = (models || []).map((m) => m.id);

  const { data: articles } = modelIds.length
    ? await supabase
        .from("article_allocations")
        .select("*, model_allocations(model, targets(brand, sales_group))")
        .in("model_allocation_id", modelIds)
    : { data: [] };

  const modelOptions = (models || []).map((m) => ({
    value: m.id,
    label: `${m.targets?.brand} ${m.model} (${m.units} units)`,
  }));

  const total = (articles || []).reduce((s, a) => s + a.units, 0);

  return (
    <>
      <Header
        title="Article Allocation"
        description="Step 3: Allocate model targets to article codes"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && modelOptions.length > 0 && (
        <AddAllocationForm
          type="articles"
          periodId={period.id}
          options={{ models: modelOptions }}
          fields={[
            { name: "model_allocation_id", label: "Model", type: "select", optionsKey: "models" },
            { name: "article_code", label: "Article Code", type: "text", placeholder: "e.g. COR-GLI-2026" },
            { name: "units", label: "Units", type: "number" },
          ]}
        />
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Article Allocations ({total} total units)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Article Code</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(articles || []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.model_allocations?.targets?.brand}</TableCell>
                  <TableCell>{a.model_allocations?.model}</TableCell>
                  <TableCell className="font-mono text-sm">{a.article_code}</TableCell>
                  <TableCell>{a.units}</TableCell>
                  <TableCell>
                    <AllocationEditor
                      type="articles"
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
