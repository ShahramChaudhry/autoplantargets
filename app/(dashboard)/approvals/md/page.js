import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { PeriodSelector } from "@/components/period-selector";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { formatPeriod } from "@/lib/utils";
import { Suspense } from "react";

export default async function MDApprovalPage({ searchParams }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: targets } = period
    ? await supabase.from("targets").select("*").eq("planning_period_id", period.id).order("brand")
    : { data: [] };

  const { data: auditComments } = period
    ? await supabase
        .from("audit_logs")
        .select("*, users(name)")
        .eq("planning_period_id", period.id)
        .in("action", ["b2b_approve", "b2b_request_changes"])
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const total = (targets || []).reduce((s, t) => s + t.target_units, 0);

  return (
    <>
      <Header
        title="Managing Director Approval"
        description="Step 6-7: Final executive review and approval"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{formatPeriod(period.month, period.year)}</CardTitle>
                <Badge variant={getStatusBadgeVariant(period.status)}>{period.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowStatus status={period.status} />
              <WorkflowActions periodId={period.id} status={period.status} role={user.role} />
            </CardContent>
          </Card>

          {auditComments?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>B2B Review History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {auditComments.map((log) => (
                  <div key={log.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-medium">{log.users?.name}</span> — {log.action}
                    {log.details?.comment && (
                      <p className="mt-1 text-slate-600">&quot;{log.details.comment}&quot;</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Target Summary ({total} units)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Sales Group</TableHead>
                    <TableHead>Target Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(targets || []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.brand}</TableCell>
                      <TableCell>{t.sales_group}</TableCell>
                      <TableCell>{t.target_units}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
