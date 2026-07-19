import { NextResponse } from "next/server";
import { mutateDb, resetMemoryCache } from "@/lib/local-db/store";

/**
 * Dev-only: wipe all plans / targets / allocations. Keeps users.
 * On Vercel this rewrites the demo cookie store for this browser.
 */
export async function POST() {
  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return NextResponse.json({ error: "Dev mode is disabled" }, { status: 403 });
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
