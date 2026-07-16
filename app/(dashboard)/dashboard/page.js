import { redirect } from "next/navigation";
import { getCurrentUser, getHomePathForRole } from "@/lib/auth";

/** Legacy /dashboard route — roles now land on their single primary view. */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(getHomePathForRole(user.role));
}
