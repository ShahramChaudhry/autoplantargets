/** User-facing hint when Supabase is missing sales_exec_targets. */
export const SALES_EXEC_TARGETS_MIGRATION_HINT =
  "Database migration required: open Supabase → SQL Editor, run supabase/add-sales-exec-targets.sql (or re-run mvp-enable.sql), then retry.";

export function isMissingSalesExecTargetsError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("sales_exec_targets") &&
    (msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      msg.includes("pgrst205") ||
      msg.includes("relation"))
  );
}

export function formatSalesExecTargetsError(error, fallback = "Failed to save") {
  if (isMissingSalesExecTargetsError(error)) {
    return SALES_EXEC_TARGETS_MIGRATION_HINT;
  }
  return error?.message || fallback;
}
