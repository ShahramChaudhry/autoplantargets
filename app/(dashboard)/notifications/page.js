import { Header } from "@/components/layout/header";
import { NotificationList } from "@/components/notification-list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const unread = (notifications || []).filter((n) => n.status === "unread").length;

  return (
    <>
      <Header
        title="Notification Center"
        description={`${unread} unread notification${unread !== 1 ? "s" : ""}`}
      />

      <NotificationList notifications={notifications || []} />
    </>
  );
}
