export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AppTopbar } from "@/components/layout/app-topbar";

export default async function DashboardLayout({ children }) {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppTopbar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
