import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";
import { formatActivityDate } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function RetailAllocationCompletion({ completedBy, completedByRole, completedAt }) {
  if (!completedAt) return null;

  const roleLabel = ROLE_LABELS[completedByRole] || completedByRole;

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="flex gap-4 py-5">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        <div className="space-y-2">
          <p className="font-semibold text-emerald-900">Retail Allocation Complete</p>
          <div className="space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-medium">Completed by:</span> {completedBy}
              {roleLabel ? ` (${roleLabel})` : ""}
            </p>
            <p>
              <span className="font-medium">Completed at:</span> {formatActivityDate(completedAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
