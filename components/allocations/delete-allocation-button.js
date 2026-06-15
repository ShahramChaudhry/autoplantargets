"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteAllocationButton({ type, id, periodId, label = "Delete allocation" }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Remove this allocation? This cannot be undone.")) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ type, id, periodId });
      const res = await fetch(`/api/allocations?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Delete failed");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      aria-label={label}
      className="text-slate-400 hover:text-red-600"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
