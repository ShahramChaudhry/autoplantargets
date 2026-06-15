import { Header } from "@/components/layout/header";
import { PlanContextBanner } from "@/components/plan/plan-context-banner";
import { AuditTimeline } from "@/components/audit/audit-timeline";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { formatAuditEntry } from "@/lib/audit";
import { getActivePlan } from "@/lib/data";

export default async function AuditPage({ searchParams }) {
  await requirePageAccess("/audit");
  const params = await searchParams;
  const plan = await getActivePlan(params?.plan);
  const supabase = await createClient();

  const { data: logs } = plan
    ? await supabase
        .from("audit_logs")
        .select("*, users(name, role)")
        .eq("planning_period_id", plan.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const entries = (logs || []).map((log) => formatAuditEntry(log, plan));

  return (
    <>
      <Header
        title="Audit History"
        description="Business activity trail for the selected monthly target plan"
      />

      {plan && <PlanContextBanner plan={plan} basePath="/audit" />}

      <AuditTimeline entries={entries} />
    </>
  );
}
