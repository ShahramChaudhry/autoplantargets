export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, getNavItems } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const navItems = getNavItems(user.role);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} navItems={navItems} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
