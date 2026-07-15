import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";

export function WorkflowGuideCard({ title, description, actionLabel, actionHref, secondaryLabel, secondaryHref }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {secondaryHref && (
            <Link href={secondaryHref} className={buttonVariants({ variant: "outline" })}>
              {secondaryLabel}
            </Link>
          )}
          <Link href={actionHref} className={cn(buttonVariants(), "gap-2")}>
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyPlansGuide() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <p className="text-lg font-semibold text-slate-900">Select a monthly target plan first</p>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Every planning workflow starts with a monthly target plan. Create one or choose an existing plan to continue.
        </p>
        <Link href="/monthly-planning" className={cn(buttonVariants(), "mt-6 gap-2")}>
          <Plus className="h-4 w-4" />
          Go to Monthly Planning
        </Link>
      </CardContent>
    </Card>
  );
}
