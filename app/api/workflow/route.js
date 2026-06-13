import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getNextStatus, logAudit } from "@/lib/workflow";
import { ROLES } from "@/lib/constants";

const ACTION_PERMISSIONS = {
  submit_b2b: [ROLES.DEMAND_SUPPLY],
  submit_md: [ROLES.DEMAND_SUPPLY],
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

  const newStatus = getNextStatus(action, period.status);

  const { error } = await supabase
    .from("planning_periods")
    .update({ status: newStatus })
    .eq("id", periodId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action,
    entityType: "planning_period",
    entityId: periodId,
    details: { from: period.status, to: newStatus, comment: comment || null },
    planningPeriodId: periodId,
  });

  if (action === "submit_b2b") {
    const { data: b2bUsers } = await supabase
      .from("users")
      .select("id")
      .eq("role", ROLES.B2B_DIRECTOR);

    for (const u of b2bUsers || []) {
      await supabase.from("notifications").insert({
        user_id: u.id,
        type: "approval_required",
        message: `Targets submitted for B2B review (${period.month}/${period.year})`,
        planning_period_id: periodId,
      });
    }
  }

  if (action === "submit_md") {
    const { data: mdUsers } = await supabase
      .from("users")
      .select("id")
      .eq("role", ROLES.MANAGING_DIRECTOR);

    for (const u of mdUsers || []) {
      await supabase.from("notifications").insert({
        user_id: u.id,
        type: "approval_required",
        message: `Targets submitted for MD review (${period.month}/${period.year})`,
        planning_period_id: periodId,
      });
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
