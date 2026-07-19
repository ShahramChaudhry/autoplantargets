import { NextResponse } from "next/server";
import { mutateDb, resetMemoryCache } from "@/lib/local-db/store";
import { getCurrentUser } from "@/lib/auth";
import { createClient, shouldUseSupabaseBackend } from "@/lib/supabase/server";

/** Delete every row in a table (PostgREST needs a filter). */
async function wipeTable(supabase, table) {
  const { error } = await supabase
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  return error;
}

/**
 * Wipe all plans / targets / allocations. Keeps users.
 * Uses shared Supabase when configured; otherwise local/cookie store.
 */
export async function POST() {
  const user = await getCurrentUser();
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  if (!user && !devMode) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  if (shouldUseSupabaseBackend()) {
    const supabase = await createClient();

    // Orphans first (period FK is SET NULL, not CASCADE)
    for (const table of ["notifications", "audit_logs"]) {
      const error = await wipeTable(supabase, table);
      if (error) {
        return NextResponse.json(
          { error: `Failed to clear ${table}: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Cascades to targets, allocations, sales_exec_targets, etc.
    const periodError = await wipeTable(supabase, "planning_periods");
    if (periodError) {
      return NextResponse.json(
        { error: `Failed to clear planning_periods: ${periodError.message}` },
        { status: 500 }
      );
    }

    // Safety pass for leftover leaf tables if FKs differ
    for (const table of [
      "sales_exec_targets",
      "executive_allocations",
      "article_allocations",
      "model_allocations",
      "sales_office_allocations",
      "targets",
    ]) {
      const error = await wipeTable(supabase, table);
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          { error: `Failed to clear ${table}: ${error.message}` },
          { status: 500 }
        );
      }
    }
  }

  // Always clear local/cookie overlay so serverless demo state cannot linger
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
    backend: shouldUseSupabaseBackend() ? "supabase" : "local",
  });
}
