"use client";

import { LogOut } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Topbar({ user }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div>
        <h1 className="text-base font-bold tracking-tight text-slate-900">AutoPlan Targets</h1>
        <p className="text-xs text-slate-500">Monthly Planning MVP</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user?.role] || user?.role}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </header>
  );
}
