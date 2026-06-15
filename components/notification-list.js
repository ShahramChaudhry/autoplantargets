"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

const NOTIFICATION_LABELS = {
  approval_required: "Approval Required",
  reconciliation_failed: "Reconciliation Issue",
  retail_allocation_ready: "Sales Office Allocation Ready",
  retail_allocation_complete: "Retail Allocation Complete",
};

export function NotificationList({ notifications }) {
  const router = useRouter();

  async function markRead(id) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "read" }),
    });
    router.refresh();
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => n.status === "unread");
    await Promise.all(
      unread.map((n) =>
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: n.id, status: "read" }),
        })
      )
    );
    router.refresh();
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-slate-500">
          <Bell className="mb-3 h-10 w-10 text-slate-300" />
          <p>No notifications yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.some((n) => n.status === "unread") && (
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      )}

      {notifications.map((n) => (
        <Card key={n.id} className={n.status === "unread" ? "border-blue-200 bg-blue-50/30" : ""}>
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={n.type === "reconciliation_failed" ? "destructive" : "secondary"}>
                  {NOTIFICATION_LABELS[n.type] || "Update"}
                </Badge>
                {n.status === "unread" && <Badge variant="default">New</Badge>}
              </div>
              <p className="text-sm text-slate-800">{n.message}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(n.created_at)}</p>
            </div>
            {n.status === "unread" && (
              <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                Mark read
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
