"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { planLabel, planSlug } from "@/lib/plans";

export function PlanSelector({ plans, currentPlan }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSlug = currentPlan ? planSlug(currentPlan.month, currentPlan.year) : "";

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("plan", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (plans.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">No monthly target plans yet. Create one to begin allocating models.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="space-y-1">
        <Label htmlFor="plan-selector">Monthly Target Plan</Label>
        <Select
          id="plan-selector"
          value={currentSlug}
          onChange={handleChange}
          className="w-56"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={planSlug(plan.month, plan.year)}>
              {planLabel(plan.month, plan.year)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
