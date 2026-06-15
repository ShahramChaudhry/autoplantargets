import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { DemandSupplyDashboard } from "@/components/dashboard/demand-supply-dashboard";
import {
  B2BDashboard,
  MDDashboard,
  NPMDashboard,
  BranchManagerDashboard,
} from "@/components/dashboard/role-dashboards";
import { requirePageAccess } from "@/lib/auth";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { getActivePlan, getDemandSupplyDashboardKPIs, getRoleDashboardData, getQueuePlan, queuePlanHref } from "@/lib/data";

export default async function DashboardPage() {
  const user = await requirePageAccess("/dashboard");

  if (user.role === ROLES.DEMAND_SUPPLY) {
    const kpis = await getDemandSupplyDashboardKPIs(user.id);
    return (
      <>
        <Header
          title={`Welcome, ${user.name}`}
          description="Monthly target planning overview"
        />
        <DemandSupplyDashboard kpis={kpis} />
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
              queueHref={queueHref}
            />
          )}
          {user.role === ROLES.MANAGING_DIRECTOR && (
            <MDDashboard
              period={plan}
              stats={roleData?.stats}
              pendingApproval={roleData?.pendingApproval}
              queueHref={queueHref}
            />
          )}
          {user.role === ROLES.NPM && (
            <NPMDashboard
              period={plan}
              stats={roleData?.stats}
              retailTotal={roleData?.retailTotal ?? 0}
              officeTotal={roleData?.officeTotal ?? 0}
            />
          )}
          {user.role === ROLES.BRANCH_MANAGER && (
            <BranchManagerDashboard
              period={plan}
              stats={roleData?.stats}
              officeTotal={roleData?.officeTotal ?? 0}
              execTotal={roleData?.execTotal ?? 0}
              reconciliationPassed={roleData?.reconciliationPassed}
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
