import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { calculateReconciliation, logAudit } from "@/lib/workflow";
import { ROLES } from "@/lib/constants";

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (![ROLES.BRANCH_MANAGER, ROLES.NPM].includes(user.role)) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { periodId } = await request.json();
  const supabase = await createClient();
  const result = await calculateReconciliation(supabase, periodId);

  const newStatus = result.passed ? "completed" : "reconciliation_failed";

  await supabase
    .from("planning_periods")
    .update({ status: newStatus })
    .eq("id", periodId);

  await logAudit(supabase, {
    userId: user.id,
    action: result.passed ? "reconciliation_passed" : "reconciliation_failed",
    entityType: "planning_period",
    entityId: periodId,
    details: result,
    planningPeriodId: periodId,
  });

  if (!result.passed) {
    const { data: branchManagers } = await supabase
      .from("users")
      .select("id")
      .eq("role", ROLES.BRANCH_MANAGER);

    const message = `Reconciliation failed: Model targets (${result.modelSum}) vs Sales Office (${result.officeSum}) vs Executive (${result.executiveSum}). Please review allocations.`;

    for (const bm of branchManagers || []) {
      await supabase.from("notifications").insert({
        user_id: bm.id,
        type: "reconciliation_failed",
        message,
        planning_period_id: periodId,
      });
    }
  }

  return NextResponse.json({ ...result, status: newStatus });
}
