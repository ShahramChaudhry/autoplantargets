import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatPeriod } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

export function B2BDashboard({ period, stats, pendingReview, queueHref = "/review-queue" }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Awaiting Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview ? 1 : 0}</div>
            <p className="text-xs text-slate-500">cycles in your queue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Target Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUnits ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unread Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.notificationCount ?? 0}</div>
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
                ? "A planning cycle is ready for your B2B review. Open the review queue to approve or request changes."
                : "No cycles are currently awaiting B2B review."}
            </p>
            <Link
              href={queueHref}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Review Queue
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function MDDashboard({ period, stats, pendingApproval, queueHref = "/approval-queue" }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Awaiting Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApproval ? 1 : 0}</div>
            <p className="text-xs text-slate-500">cycles in your queue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Target Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUnits ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unread Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.notificationCount ?? 0}</div>
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
              Open Approval Queue
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function NPMDashboard({ period, stats, retailTotal, officeTotal }) {
  const balanced = retailTotal === officeTotal;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Retail Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{retailTotal}</div>
            <p className="text-xs text-slate-500">units to allocate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Office Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{officeTotal}</div>
            <p className={`text-xs ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
              {balanced ? "Balanced with retail target" : `${officeTotal - retailTotal} unit variance`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unread Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.notificationCount ?? 0}</div>
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
            </p>
            <Link
              href="/retail-allocations"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Sales Office Allocation
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function BranchManagerDashboard({ period, stats, officeTotal, execTotal, reconciliationPassed }) {
  const balanced = officeTotal === execTotal;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Office Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{officeTotal}</div>
            <p className="text-xs text-slate-500">units across offices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Executive Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{execTotal}</div>
            <p className={`text-xs ${balanced ? "text-emerald-600" : "text-red-600"}`}>
              {balanced ? "Matches office targets" : `${execTotal - officeTotal} unit variance`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reconciliationPassed ? "Passed" : period?.status === "completed" ? "Passed" : "Pending"}
            </div>
            <p className="text-xs text-slate-500">
              {period?.status === "reconciliation_failed" ? "Action required" : "Run from executive allocation"}
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
              Distribute office targets to sales executives and run reconciliation when allocations are complete.
            </p>
            <Link
              href="/executive-allocations"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Executive Allocation
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
