import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowPipeline } from "@/components/workflow/workflow-pipeline";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel, planStepPath } from "@/lib/plans";
import { Target, Car, Package, ClipboardCheck, Send, ArrowRight } from "lucide-react";

const workspaceLinks = [
  { step: "targets", label: "Target Creation", icon: Target, description: "Set brand and sales group targets" },
  { step: "models", label: "Model Allocation", icon: Car, description: "Distribute targets across vehicle models" },
  { step: "articles", label: "Article Allocation", icon: Package, description: "Break models down by article code (optional)" },
  { step: "review", label: "Review", icon: ClipboardCheck, description: "Confirm plan completeness" },
  { step: "submit", label: "Submit", icon: Send, description: "Submit plan for approval" },
];

export function PlanWorkspace({ plan, stats }) {
  const label = planLabel(plan.month, plan.year);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{label} — Plan Workspace</CardTitle>
            <Badge variant={getStatusBadgeVariant(plan.status)}>
              {STATUS_LABELS[plan.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <WorkflowPipeline status={plan.status} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Total Target Units</p>
              <p className="text-2xl font-bold">{stats?.totalUnits ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Model Lines</p>
              <p className="text-2xl font-bold">{stats?.modelCount ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Article Lines</p>
              <p className="text-2xl font-bold">{stats?.articleCount ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workspaceLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.step} href={planStepPath(item.step, plan.month, plan.year)}>
              <Card className="h-full transition-colors hover:border-slate-300 hover:bg-slate-50">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
