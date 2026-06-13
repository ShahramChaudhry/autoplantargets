import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelector } from "@/components/period-selector";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPeriods, getActivePeriod } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { Suspense } from "react";

export default async function AuditPage({ searchParams }) {
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const supabase = await createClient();

  const { data: logs } = period
    ? await supabase
        .from("audit_logs")
        .select("*, users(name, role)")
        .eq("planning_period_id", period.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <>
      <Header
        title="Audit History"
        description="Complete trail of actions across the planning workflow"
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({(logs || []).length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs || []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{log.users?.name || "System"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.entity_type}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-slate-500">
                    {log.details?.comment ||
                      (log.details?.to && `→ ${log.details.to}`) ||
                      JSON.stringify(log.details).slice(0, 80)}
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
