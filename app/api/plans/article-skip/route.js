import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { isPlanEditable, logAudit } from "@/lib/workflow";

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== ROLES.DEMAND_SUPPLY) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { periodId, skipped } = await request.json();

  if (!periodId || typeof skipped !== "boolean") {
    return NextResponse.json({ error: "periodId and skipped are required" }, { status: 400 });
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

  if (!isPlanEditable(period.status)) {
    return NextResponse.json({ error: "Plan is locked and cannot be edited" }, { status: 400 });
  }

  const { error } = await supabase
    .from("planning_periods")
    .update({ article_allocation_skipped: skipped })
    .eq("id", periodId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: skipped ? "skip_article_allocation" : "unskip_article_allocation",
    entityType: "planning_period",
    entityId: periodId,
    details: { article_allocation_skipped: skipped },
    planningPeriodId: periodId,
  });

  return NextResponse.json({ success: true, article_allocation_skipped: skipped });
}
