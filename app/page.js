import { redirect } from "next/navigation";
import { getCurrentUser, getHomePathForRole } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(getHomePathForRole(user.role));
}
