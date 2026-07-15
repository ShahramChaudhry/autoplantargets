import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import {
  B2BDashboard,
  MDDashboard,
  NPMDashboard,
  BranchManagerDashboard,
  ITAdminDashboard,
} from "@/components/dashboard/role-dashboards";
import { requirePageAccess, getCurrentUser } from "@/lib/auth";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import {
  getActivePlan,
  getRoleDashboardData,
  getQueuePlan,
  queuePlanHref,
  getITAdminDashboardData,
} from "@/lib/data";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (current?.role === ROLES.DEMAND_SUPPLY) {
    redirect("/monthly-planning");
  }
  if (current?.role === ROLES.B2B_DIRECTOR) {
    redirect("/approvals");
  }

  const user = await requirePageAccess("/dashboard");

  if (user.role === ROLES.IT_ADMIN) {
    const adminData = await getITAdminDashboardData();
    return (
      <>
        <Header
          title={`Welcome, ${user.name}`}
          description={`${ROLE_LABELS[user.role]} dashboard`}
        />
        <ITAdminDashboard {...adminData} />
      </>
    );
  }

  const plan =
    user.role === ROLES.B2B_DIRECTOR || user.role === ROLES.MANAGING_DIRECTOR
      ? await getQueuePlan(user.role)
      : await getActivePlan();
  const roleData = plan ? await getRoleDashboardData(user.role, plan.id, user.id) : null;
  const queueHref = queuePlanHref(user.role, plan);

  return (
    <>
      <Header
        title={`Welcome, ${user.name}`}
        description={`${ROLE_LABELS[user.role]} dashboard`}
      />

      {plan ? (
        <>
          {user.role === ROLES.B2B_DIRECTOR && (
            <B2BDashboard
              period={plan}
              stats={roleData?.stats}
              pendingReview={roleData?.pendingReview}
              approvedToday={roleData?.approvedToday}
              returnedPlans={roleData?.returnedPlans}
              queueHref={queueHref}
            />
          )}
          {user.role === ROLES.MANAGING_DIRECTOR && (
            <MDDashboard
              period={plan}
              stats={roleData?.stats}
              pendingApproval={roleData?.pendingApproval}
              approvedPlans={roleData?.approvedPlans}
              queueHref={queueHref}
            />
          )}
          {user.role === ROLES.NPM && (
            <NPMDashboard
              period={plan}
              stats={roleData?.stats}
              retailTotal={roleData?.retailTotal ?? 0}
              officeTotal={roleData?.officeTotal ?? 0}
              pendingRetail={roleData?.pendingRetail}
              completedAllocations={roleData?.completedAllocations}
            />
          )}
          {user.role === ROLES.BRANCH_MANAGER && (
            <BranchManagerDashboard
              period={plan}
              stats={roleData?.stats}
              officeTotal={roleData?.officeTotal ?? 0}
              execTotal={roleData?.execTotal ?? 0}
              reconciliationPassed={roleData?.reconciliationPassed}
              pendingExecutive={roleData?.pendingExecutive}
              reconciliationIssues={roleData?.reconciliationIssues}
            />
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No monthly target plans found yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}
