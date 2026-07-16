import { Header } from "@/components/layout/header";
import { PlanLifecycleCard } from "@/components/workflow/plan-lifecycle-card";
import { RetailAllocationContent } from "@/components/allocations/retail-allocation-content";
import { ExecutiveAllocationContent } from "@/components/allocations/executive-allocation-content";
import { requirePageAccess } from "@/lib/auth";
import { getActivePlan } from "@/lib/data";
import { ROLES } from "@/lib/constants";

export default async function AllocationsPage({ searchParams }) {
  const user = await requirePageAccess("/allocations");
  const params = await searchParams;
  const plan = await getActivePlan(params?.plan);
  const isRetailHead = user.role === ROLES.NPM;

  return (
    <>
      <Header
        title="Allocations"
        description={
          isRetailHead
            ? "Split Retail targets across sales offices"
            : "Allocate Sales Office targets to Sales Executives and resolve reconciliation"
        }
      />

      <PlanLifecycleCard plan={plan} />

      {isRetailHead ? (
        <RetailAllocationContent plan={plan} user={user} />
      ) : (
        <ExecutiveAllocationContent plan={plan} user={user} />
      )}
    </>
  );
}
