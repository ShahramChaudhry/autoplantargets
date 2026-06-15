import { getCurrentUser, getNavItems } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export async function AppSidebar() {
  const user = await getCurrentUser();
  if (!user) return null;

  const navItems = getNavItems(user.role);

  return <Sidebar key={`${user.id}-${user.role}`} user={user} navItems={navItems} />;
}
