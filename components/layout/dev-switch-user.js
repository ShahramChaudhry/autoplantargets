"use client";

import { useEffect, useState } from "react";
import { SEED_USERS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Eraser, UserCog } from "lucide-react";

export function DevSwitchUser() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setEmail(user.email);
      }
    });
  }, []);

  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return null;
  }

  const currentUser = SEED_USERS.find((u) => u.email === email);

  async function handleSwitch() {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to switch user");
        return;
      }

      window.location.assign("/");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearPlans() {
    if (
      !window.confirm(
        "Clear ALL planning periods, targets, and allocations? Users will be kept."
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/dev/reset-plans", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to clear plans");
        return;
      }
      window.location.assign("/monthly-planning");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {currentUser && (
        <p className="text-xs text-amber-900">
          Signed in as <span className="font-medium">{currentUser.name}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
        <UserCog className="h-4 w-4 text-amber-700" />
        <span className="text-xs font-medium text-amber-800">Dev: Switch User</span>
        <Select
          value={email || undefined}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 w-52 text-xs"
          disabled={!email}
        >
          {SEED_USERS.map((u) => (
            <option key={u.email} value={u.email}>
              {u.name}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="outline" onClick={handleSwitch} disabled={loading || !email}>
          {loading ? "Switching..." : "Switch"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearPlans}
          disabled={clearing}
          className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
        >
          <Eraser className="h-3.5 w-3.5" />
          {clearing ? "Clearing..." : "Clear plans"}
        </Button>
      </div>
    </div>
  );
}
