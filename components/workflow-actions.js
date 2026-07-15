"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAvailableActions } from "@/lib/workflow";

export function WorkflowActions({
  periodId,
  status,
  role,
  showCommentAlways = false,
  commentLabel = "Comments",
  onSuccess,
}) {
  const actions = getAvailableActions(status, role);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (actions.length === 0) return null;

  const needsComment = actions.some((a) =>
    ["b2b_request_changes", "md_request_changes"].includes(a.action)
  );

  async function handleAction(action) {
    if (
      ["b2b_request_changes", "md_request_changes"].includes(action) &&
      !comment.trim()
    ) {
      alert("Please add a comment explaining the requested changes.");
      return;
    }

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

      if (onSuccess) {
        onSuccess(action);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Approval Actions</h3>

      {(showCommentAlways || needsComment) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            {commentLabel}
            {needsComment && <span className="text-red-600"> *</span>}
          </label>
          <Textarea
            placeholder="Add review comments or describe changes required..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
          {needsComment && (
            <p className="text-xs text-slate-500">
              A comment is required when requesting changes.
            </p>
          )}
        </div>
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
