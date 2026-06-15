import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  canPerformAction,
  getNextStatus,
  logAudit,
  notifyUsers,
} from "@/lib/workflow";
import { validateRetailAllocationComplete } from "@/lib/retail-allocation";
import { ROLES } from "@/lib/constants";
import { planLabel } from "@/lib/plans";

const ACTION_PERMISSIONS = {
  submit_b2b: [ROLES.DEMAND_SUPPLY],
  finalize: [ROLES.DEMAND_SUPPLY],
  b2b_approve: [ROLES.B2B_DIRECTOR],
  b2b_request_changes: [ROLES.B2B_DIRECTOR],
  md_approve: [ROLES.MANAGING_DIRECTOR],
  md_request_changes: [ROLES.MANAGING_DIRECTOR],
  start_retail: [ROLES.NPM],
};

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId, action, comment } = await request.json();
  const allowed = ACTION_PERMISSIONS[action];

  if (!allowed || !allowed.includes(user.role)) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  if (
    ["b2b_request_changes", "md_request_changes"].includes(action) &&
    !comment?.trim()
  ) {
    return NextResponse.json({ error: "Comment is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: period } = await supabase
    .from("planning_periods")
    .select("*")
    .eq("id", periodId)
    .single();

  if (!period) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  if (!canPerformAction(action, period.status, user.role)) {
    return NextResponse.json(
      { error: "This action is not available for the current plan status." },
      { status: 400 }
    );
  }

  let retailCompletion = null;

  if (action === "start_retail") {
    retailCompletion = await validateRetailAllocationComplete(supabase, periodId);
    if (retailCompletion.error) {
      return NextResponse.json({ error: retailCompletion.error }, { status: 400 });
    }
  }

  const newStatus = getNextStatus(action, period.status);
  const planName = planLabel(period.month, period.year);

  const { error } = await supabase
    .from("planning_periods")
    .update({ status: newStatus })
    .eq("id", periodId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: action === "start_retail" ? "complete_retail_allocation" : action,
    entityType: "planning_period",
    entityId: periodId,
    details:
      action === "start_retail"
        ? {
            from: period.status,
            to: newStatus,
            retail_target: retailCompletion.retailTarget,
            allocated: retailCompletion.allocated,
            office_count: retailCompletion.officeCount,
          }
        : { from: period.status, to: newStatus, comment: comment?.trim() || null },
    planningPeriodId: periodId,
  });

  if (action === "submit_b2b") {
    await notifyUsers(supabase, {
      role: ROLES.B2B_DIRECTOR,
      type: "approval_required",
      message: `${planName} plan submitted for B2B review`,
      planningPeriodId: periodId,
    });
  }

  if (action === "b2b_approve") {
    await notifyUsers(supabase, {
      role: ROLES.MANAGING_DIRECTOR,
      type: "approval_required",
      message: `${planName} plan approved by B2B and forwarded for MD review`,
      planningPeriodId: periodId,
    });
  }

  if (action === "b2b_request_changes") {
    await notifyUsers(supabase, {
      role: ROLES.DEMAND_SUPPLY,
      type: "changes_requested",
      message: `B2B Director requested changes on ${planName} plan`,
      planningPeriodId: periodId,
    });
  }

  if (action === "md_approve") {
    await notifyUsers(supabase, {
      role: ROLES.DEMAND_SUPPLY,
      type: "approved",
      message: `Managing Director approved ${planName} plan`,
      planningPeriodId: periodId,
    });
  }

  if (action === "md_request_changes") {
    await notifyUsers(supabase, {
      role: ROLES.DEMAND_SUPPLY,
      type: "changes_requested",
      message: `Managing Director requested changes on ${planName} plan`,
      planningPeriodId: periodId,
    });
  }

  if (action === "finalize") {
    await notifyUsers(supabase, {
      role: ROLES.NPM,
      type: "retail_allocation_ready",
      message: `${planName} plan has been finalized. Sales Office Allocation can begin.`,
      planningPeriodId: periodId,
    });
  }

  if (action === "start_retail") {
    await notifyUsers(supabase, {
      role: ROLES.BRANCH_MANAGER,
      type: "retail_allocation_complete",
      message: `Retail allocation for ${planName} is complete. Executive allocation can now begin.`,
      planningPeriodId: periodId,
    });
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    message: action === "start_retail" ? "Retail allocation completed successfully." : undefined,
  });
}
