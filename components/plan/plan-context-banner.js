import Link from "next/link";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel, planSlug } from "@/lib/plans";
import { Calendar, ChevronRight } from "lucide-react";

export function PlanContextBanner({ plan, basePath }) {
  if (!plan) return null;

  const slug = planSlug(plan.month, plan.year);
  const label = planLabel(plan.month, plan.year);
  const query = `plan=${slug}`;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2">
          <Calendar className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Monthly Target Plan
          </p>
          <p className="font-semibold text-slate-900">{label}</p>
        </div>
        <Badge variant={getStatusBadgeVariant(plan.status)}>
          {STATUS_LABELS[plan.status]}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/monthly-planning/${slug}`} className="text-slate-600 hover:text-slate-900">
          Plan workspace
        </Link>
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <Link href="/monthly-planning" className="font-medium text-slate-900 hover:underline">
          Switch plan
        </Link>
        {basePath && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <Link href={`${basePath}?${query}`} className="text-slate-600 hover:text-slate-900">
              Refresh view
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
