import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatus } from "@/components/workflow-status";
import { WorkflowActions } from "@/components/workflow-actions";
import { PeriodSelector } from "@/components/period-selector";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getPlanningPeriods, getActivePeriod, getDashboardStats } from "@/lib/data";
import { ROLE_LABELS } from "@/lib/constants";
import { formatPeriod } from "@/lib/utils";
import { Target, Car, Building2, Bell } from "lucide-react";
import { Suspense } from "react";

export default async function DashboardPage({ searchParams }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const periods = await getPlanningPeriods();
  const period = await getActivePeriod(params?.period);
  const stats = period ? await getDashboardStats(period.id) : null;

  return (
    <>
      <Header
        title={`Welcome, ${user.name}`}
        description={`${ROLE_LABELS[user.role]} — AutoPlan Targets Dashboard`}
      />

      {periods.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <PeriodSelector periods={periods} currentId={period?.id} />
          </Suspense>
        </div>
      )}

      {period ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{formatPeriod(period.month, period.year)} Planning Cycle</CardTitle>
                <Badge variant={getStatusBadgeVariant(period.status)}>
                  {period.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <WorkflowStatus status={period.status} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Brand Targets</CardTitle>
                <Target className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.targetCount}</div>
                <p className="text-xs text-slate-500">{stats.totalUnits} total units</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Model Allocations</CardTitle>
                <Car className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.modelCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Sales Offices</CardTitle>
                <Building2 className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.officeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Unread Notifications</CardTitle>
                <Bell className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.notificationCount}</div>
              </CardContent>
            </Card>
          </div>

          <WorkflowActions periodId={period.id} status={period.status} role={user.role} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No planning periods found. Run the seed script in Supabase to get started.
          </CardContent>
        </Card>
      )}
    </>
  );
}
