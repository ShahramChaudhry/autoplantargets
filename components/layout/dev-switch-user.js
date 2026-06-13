"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEED_USERS } from "@/lib/constants";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";

export function DevSwitchUser() {
  const [email, setEmail] = useState(SEED_USERS[0].email);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return null;
  }

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

      router.refresh();
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
      <UserCog className="h-4 w-4 text-amber-700" />
      <span className="text-xs font-medium text-amber-800">Dev: Switch User</span>
      <Select
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-8 w-52 text-xs"
      >
        {SEED_USERS.map((u) => (
          <option key={u.email} value={u.email}>
            {u.name}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="outline" onClick={handleSwitch} disabled={loading}>
        {loading ? "Switching..." : "Switch"}
      </Button>
    </div>
  );
}
