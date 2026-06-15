"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

export function InlineUnitsEditor({
  type,
  recordId,
  field,
  value,
  periodId,
  label = "units",
  max,
  disabled = false,
}) {
  const [editing, setEditing] = useState(false);
  const [units, setUnits] = useState(String(value));
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
          id: recordId,
          periodId,
          data: { [field]: parseInt(units, 10) || 0 },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Update failed");
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (disabled || !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-900">{value}</span>
        <span className="text-xs text-slate-500">{label}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Edit units"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={units}
        onChange={(e) => setUnits(e.target.value)}
        className="h-8 w-20 text-right"
        min="1"
        max={max}
        autoFocus
      />
      <Button size="sm" variant="ghost" onClick={handleSave} disabled={loading} aria-label="Save">
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setUnits(String(value));
          setEditing(false);
        }}
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
