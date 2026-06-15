"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Car,
  Package,
  Building2,
  Users,
  Bell,
  History,
  LogOut,
  Calendar,
  Activity,
  ClipboardList,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const iconMap = {
  LayoutDashboard,
  Target,
  Car,
  Package,
  Building2,
  Users,
  Bell,
  History,
  Calendar,
  Activity,
  ClipboardList,
  Shield,
};

export function Sidebar({ user, navItems }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-950 text-white">
      <div className="border-b border-slate-800 p-6">
        <h1 className="text-lg font-bold tracking-tight">AutoPlan Targets</h1>
        <p className="mt-1 text-xs text-slate-400">Monthly Planning MVP</p>
      </div>

      <div className="border-b border-slate-800 px-4 py-3">
        <p className="text-sm font-medium">{user?.name}</p>
        <p className="text-xs text-slate-400">{ROLE_LABELS[user?.role]}</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
