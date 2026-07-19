"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

/** One-click wipe of all plans (keeps users). For demo clean slate. */
export function ClearPlansButton({ className }) {
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    if (
      !window.confirm(
        "Clear ALL planning periods (May–September etc.), targets, and allocations?\n\nUsers will be kept. You can create a new plan afterward."
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/dev/reset-plans", { method: "POST" });
      const data = await res.json().catch(() => ({}));
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClear}
      disabled={clearing}
      className={className || "gap-1.5 border-red-200 text-red-700 hover:bg-red-50"}
    >
      <Eraser className="h-3.5 w-3.5" />
      {clearing ? "Clearing..." : "Clear all plans"}
    </Button>
  );
}
