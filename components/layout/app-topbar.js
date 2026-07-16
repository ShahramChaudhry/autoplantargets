import { getCurrentUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";

export async function AppTopbar() {
  const user = await getCurrentUser();
  if (!user) return null;

  return <Topbar key={`${user.id}-${user.role}`} user={user} />;
}
