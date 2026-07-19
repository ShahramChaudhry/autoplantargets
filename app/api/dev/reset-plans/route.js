import { NextResponse } from "next/server";
import { mutateDb, resetMemoryCache } from "@/lib/local-db/store";
import { getCurrentUser } from "@/lib/auth";

/**
 * Wipe all plans / targets / allocations. Keeps users.
 * Demo clean-slate for signed-in users (or when DEV_MODE is on).
 */
export async function POST() {
  const user = await getCurrentUser();
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  if (!user && !devMode) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  resetMemoryCache();

  await mutateDb((db) => {
    db.planning_periods = [];
    db.targets = [];
    db.model_allocations = [];
    db.article_allocations = [];
    db.sales_office_allocations = [];
    db.executive_allocations = [];
    db.sales_exec_targets = [];
    db.notifications = [];
    db.audit_logs = [];
  });

  return NextResponse.json({
    success: true,
    message: "All plans cleared. Users kept. Create a new plan from Monthly Planning.",
  });
}
