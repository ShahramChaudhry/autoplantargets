import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";
import { formatAuditEntry } from "@/lib/audit";
import { Users, Shield, History, Activity } from "lucide-react";

export default async function AdministrationPage() {
  await requirePageAccess("/administration");
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, created_at")
    .order("name");

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*, users(name, role)")
    .order("created_at", { ascending: false })
    .limit(20);

  const { count: planCount } = await supabase
    .from("planning_periods")
    .select("*", { count: "exact", head: true });

  const { count: notificationCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true });

  return (
    <>
      <Header
        title="Administration"
        description="User management, role overview, and administrative audit"
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Users</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Planning Periods</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Notifications</CardTitle>
            <History className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notificationCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <CardTitle>User & Role Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {(users || []).map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-medium text-slate-900">{u.name}</td>
                      <td className="py-3 pr-3 text-slate-600">{u.email}</td>
                      <td className="py-3">
                        <Badge variant="secondary">{ROLE_LABELS[u.role] || u.role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Role changes and administrative corrections are managed through seed/dev tooling in
              this MVP build.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <CardTitle>Recent Audit Events</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(auditLogs || []).length === 0 ? (
              <p className="text-sm text-slate-500">No audit events recorded yet.</p>
            ) : (
              (auditLogs || []).map((log) => {
                const entry = formatAuditEntry(log, null);
                return (
                  <div key={log.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{entry.headline}</p>
                      <span className="text-xs text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      {entry.userName}
                      {entry.role ? ` · ${entry.role}` : ""}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
