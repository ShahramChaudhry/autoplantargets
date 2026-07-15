import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === ROLES.DEMAND_SUPPLY) redirect("/monthly-planning");
  if (user.role === ROLES.B2B_DIRECTOR) redirect("/approvals");
  redirect("/dashboard");
}
