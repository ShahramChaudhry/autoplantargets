import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { FinalizePlanAction } from "@/components/workflow/finalize-plan-action";
import { STATUS_LABELS } from "@/lib/constants";
import { planWorkspacePath, planStepPath } from "@/lib/plans";
import { formatPeriod } from "@/lib/utils";
import {
  FileEdit,
  Send,
  RotateCcw,
  CheckCircle2,
  Bell,
} from "lucide-react";

function KpiCard({ title, value, subtitle, icon: Icon, href }) {
  const content = (
    <Card className={href ? "transition-colors hover:border-slate-300 hover:bg-slate-50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function DemandSupplyDashboard({ kpis }) {
  const plan = kpis.activePlan;
  const finalizePlan = kpis.planReadyToFinalize;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Draft Plans"
          value={kpis.draftPlans}
          subtitle="In progress"
          icon={FileEdit}
          href="/monthly-planning"
        />
        <KpiCard
          title="Submitted Plans"
          value={kpis.submittedPlans}
          subtitle="Awaiting approval"
          icon={Send}
          href="/monthly-planning"
        />
        <KpiCard
          title="Returned Plans"
          value={kpis.returnedPlans}
          subtitle="Changes requested"
          icon={RotateCcw}
          href="/monthly-planning"
        />
        <KpiCard
          title="Completed Plans"
          value={kpis.completedPlans}
          subtitle="Fully completed"
          icon={CheckCircle2}
        />
        <KpiCard
          title="Notifications"
          value={kpis.notifications}
          subtitle="Unread messages"
          icon={Bell}
          href="/notifications"
        />
      </div>

      {finalizePlan && (
        <FinalizePlanAction
          periodId={finalizePlan.id}
          planName={formatPeriod(finalizePlan.month, finalizePlan.year)}
          status={finalizePlan.status}
        />
      )}

      {!plan ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold text-slate-900">Start your first monthly target plan</p>
            <p className="mt-2 text-sm text-slate-500">
              Create a plan to begin the guided planning workflow — no seed data required.
            </p>
            <Link
              href="/monthly-planning"
              className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create Monthly Target Plan
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{formatPeriod(plan.month, plan.year)} Monthly Target Plan</CardTitle>
              <Badge variant={getStatusBadgeVariant(plan.status)}>
                {STATUS_LABELS[plan.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-slate-600">
              Continue the guided monthly planning workflow — targets, allocations, review, and
              submit.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={planWorkspacePath(plan.month, plan.year)}
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Open Monthly Planning
              </Link>
              {plan.status === "md_approved" && (
                <Link
                  href={planStepPath("submit", plan.month, plan.year)}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Finalize Plan
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
