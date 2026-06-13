"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AllocationEditor({ type, id, field, value, periodId }) {
  const [units, setUnits] = useState(value);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id,
          periodId,
          data: { [field]: parseInt(units, 10) || 0 },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Update failed");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={units}
        onChange={(e) => setUnits(e.target.value)}
        className="w-24"
        min="0"
      />
      <Button size="sm" variant="outline" onClick={handleSave} disabled={loading}>
        Save
      </Button>
    </div>
  );
}
