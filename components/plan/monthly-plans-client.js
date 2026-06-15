"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatePlanModal } from "@/components/plan/create-plan-modal";
import { DemandSupplyStepper } from "@/components/workflow/demand-supply-stepper";
import { STATUS_LABELS } from "@/lib/constants";
import { planLabel, planWorkspacePath } from "@/lib/plans";
import { ArrowRight, Calendar, Plus } from "lucide-react";

export function MonthlyPlansClient({ plans }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <DemandSupplyStepper currentStep="plan" plan={null} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">
            {plans.length === 0
              ? "Get started by creating your first monthly target plan."
              : `${plans.length} monthly target plan${plans.length === 1 ? "" : "s"} available`}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Monthly Target Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <Calendar className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No monthly target plans yet</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Create a plan for the month you want to plan. Then add brand targets, allocate to models
              and articles, and submit for approval.
            </p>
            <Button className="mt-6 gap-2" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Monthly Target Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex h-full flex-col">
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <Calendar className="h-5 w-5 text-slate-700" />
                  </div>
                  <Badge variant={getStatusBadgeVariant(plan.status)}>
                    {STATUS_LABELS[plan.status]}
                  </Badge>
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  {planLabel(plan.month, plan.year)}
                </h2>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="font-medium text-slate-900">{STATUS_LABELS[plan.status]}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Targets</dt>
                    <dd className="font-medium text-slate-900">{plan.targetCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Total units</dt>
                    <dd className="font-medium text-slate-900">{plan.totalUnits.toLocaleString()}</dd>
                  </div>
                </dl>

                <Link
                  href={planWorkspacePath(plan.month, plan.year)}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:underline"
                >
                  Open Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePlanModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
