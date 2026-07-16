import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatPeriod } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

export function B2BDashboard({
  period,
  stats,
  pendingReview,
  approvedToday = 0,
  returnedPlans = 0,
  queueHref = "/approvals",
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview ? 1 : 0}</div>
            <p className="text-xs text-slate-500">plans awaiting your review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Approved Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedToday}</div>
            <p className="text-xs text-slate-500">B2B approvals today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Returned Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{returnedPlans}</div>
            <p className="text-xs text-slate-500">changes requested</p>
          </CardContent>
        </Card>
      </div>

      {period && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Cycle — {formatPeriod(period.month, period.year)}</CardTitle>
              <Badge variant={getStatusBadgeVariant(period.status)}>
                {STATUS_LABELS[period.status] || period.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              {pendingReview
                ? "A planning cycle is ready for your B2B review. Open Approvals to approve or request changes."
                : "No cycles are currently awaiting B2B review."}
            </p>
            <Link
              href={queueHref}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Approvals
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function MDDashboard({
  period,
  stats,
  pendingApproval,
  approvedPlans = 0,
  queueHref = "/approvals",
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending Final Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApproval ? 1 : 0}</div>
            <p className="text-xs text-slate-500">plans approved by B2B Director</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Approved Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedPlans}</div>
            <p className="text-xs text-slate-500">MD approved / beyond</p>
          </CardContent>
        </Card>
      </div>

      {period && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Cycle — {formatPeriod(period.month, period.year)}</CardTitle>
              <Badge variant={getStatusBadgeVariant(period.status)}>
                {STATUS_LABELS[period.status] || period.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              {pendingApproval
                ? "A planning cycle has passed B2B review and awaits your final approval."
                : "No cycles are currently awaiting MD approval."}
            </p>
            <Link
              href={queueHref}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Approvals
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function NPMDashboard({
  period,
  stats,
  retailTotal,
  officeTotal,
  pendingRetail = 0,
  completedAllocations = 0,
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending Retail Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRetail}</div>
            <p className="text-xs text-slate-500">plans ready for office allocation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Completed Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAllocations}</div>
            <p className="text-xs text-slate-500">retail allocation finished</p>
          </CardContent>
        </Card>
      </div>

      {period && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{formatPeriod(period.month, period.year)}</CardTitle>
              <Badge variant={getStatusBadgeVariant(period.status)}>
                {STATUS_LABELS[period.status] || period.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Allocate retail targets across sales offices for the active planning cycle.
              {retailTotal > 0 && (
                <>
                  {" "}
                  Retail target: <strong>{retailTotal}</strong> · Allocated:{" "}
                  <strong>{officeTotal}</strong>.
                </>
              )}
            </p>
            <Link
              href="/allocations"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Allocations
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function BranchManagerDashboard({
  period,
  stats,
  officeTotal,
  execTotal,
  reconciliationPassed,
  pendingExecutive = 0,
  reconciliationIssues = 0,
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Pending Executive Allocations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExecutive}</div>
            <p className="text-xs text-slate-500">office targets awaiting executives</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Reconciliation Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliationIssues}</div>
            <p className="text-xs text-slate-500">
              {period?.status === "reconciliation_failed" ? "Action required" : "failed cycles"}
            </p>
          </CardContent>
        </Card>
      </div>

      {period && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{formatPeriod(period.month, period.year)}</CardTitle>
              <Badge variant={getStatusBadgeVariant(period.status)}>
                {STATUS_LABELS[period.status] || period.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Distribute office targets to sales executives and run reconciliation when allocations
              are complete.
              {officeTotal > 0 && (
                <>
                  {" "}
                  Office: <strong>{officeTotal}</strong> · Executives: <strong>{execTotal}</strong>
                  {reconciliationPassed || period?.status === "completed"
                    ? " · Reconciliation passed"
                    : ""}
                  .
                </>
              )}
            </p>
            <Link
              href="/allocations"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Allocations
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
