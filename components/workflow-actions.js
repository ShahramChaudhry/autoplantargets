"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAvailableActions } from "@/lib/workflow";

export function WorkflowActions({ periodId, status, role }) {
  const actions = getAvailableActions(status, role);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (actions.length === 0) return null;

  async function handleAction(action) {
    setLoading(true);
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, action, comment }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const needsComment = actions.some((a) =>
    ["b2b_request_changes", "md_request_changes"].includes(a.action)
  );

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Available Actions</h3>
      {needsComment && (
        <Textarea
          placeholder="Add a comment (required for change requests)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.action}
            variant={a.action.includes("request") ? "destructive" : "default"}
            disabled={loading}
            onClick={() => handleAction(a.action)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
