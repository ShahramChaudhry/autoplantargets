import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  assertOfficeAccess,
  getExecutivesForOffice,
  isExecutiveAllocationEditable,
  EXEC_ALLOCATION_LOCKED_MESSAGE,
} from "@/lib/executive-allocation";
import {
  buildOfficeModelTargets,
  computeExecAllocationStatus,
  cellKey,
  parseUnits,
} from "@/lib/exec-allocation-rollup";
import {
  isExecutiveAllocationAllowed,
  EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE,
} from "@/lib/retail-allocation";
import { logAudit } from "@/lib/workflow";
import { formatSalesExecTargetsError } from "@/lib/sales-exec-targets-migration";

async function findLeaf(supabase, periodId, row) {
  let query = supabase
    .from("sales_exec_targets")
    .select("id")
    .eq("planning_period_id", periodId)
    .eq("sales_group", row.sales_group)
    .eq("sales_office", row.sales_office)
    .eq("sales_exec_code", row.sales_exec_code)
    .eq("model", row.model);

  if (row.brand) query = query.eq("brand", row.brand);
  else query = query.is("brand", null);

  query = query.is("article_code", null);

  const { data } = await query.maybeSingle();
  return data;
}

/**
 * Branch Manager saves Sales Executive × Model leaf allocations for one office.
 * Draft saves allowed when under-allocated; over-allocation is rejected.
 */
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.BRANCH_MANAGER) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const body = await request.json();
  const {
    periodId,
    salesGroup = "Retail",
    salesOffice,
    rows = [],
    markComplete = false,
  } = body;

  if (!periodId || !salesOffice) {
    return NextResponse.json(
      { error: "periodId and salesOffice are required" },
      { status: 400 }
    );
  }

  const access = assertOfficeAccess(user, salesOffice);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: period } = await supabase
    .from("planning_periods")
    .select("id, status")
    .eq("id", periodId)
    .single();

  if (!period) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (!isExecutiveAllocationAllowed(period.status)) {
    return NextResponse.json(
      { error: EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE },
      { status: 400 }
    );
  }

  if (!isExecutiveAllocationEditable(period.status)) {
    return NextResponse.json({ error: EXEC_ALLOCATION_LOCKED_MESSAGE }, { status: 400 });
  }

  try {
    const { data: targets } = await supabase
      .from("targets")
      .select("brand, sales_group, model, sales_office, article_code, target_units")
      .eq("planning_period_id", periodId)
      .eq("sales_group", salesGroup);

    const models = buildOfficeModelTargets(targets || [], salesGroup, salesOffice);
    if (models.length === 0) {
      return NextResponse.json(
        { error: "No office model targets found for this sales office." },
        { status: 400 }
      );
    }

    const executives = getExecutivesForOffice(user, salesOffice);
    if (executives.length === 0) {
      return NextResponse.json(
        { error: "No sales executives assigned to this office." },
        { status: 400 }
      );
    }

    const allowedExec = new Set(executives.map((e) => e.id));
    const allowedModel = new Map(models.map((m) => [`${m.brand || ""}::${m.model}`, m]));

    const values = {};
    for (const row of rows) {
      if (!row.sales_exec_code || !row.model) continue;
      if (!allowedExec.has(String(row.sales_exec_code))) {
        return NextResponse.json(
          { error: `Sales executive ${row.sales_exec_code} is not assigned to this office.` },
          { status: 400 }
        );
      }
      const modelKey = `${row.brand || ""}::${row.model}`;
      if (!allowedModel.has(modelKey) && !allowedModel.has(`::${row.model}`)) {
        const match = models.find((m) => m.model === row.model);
        if (!match) {
          return NextResponse.json(
            { error: `Model ${row.model} is not assigned to this office.` },
            { status: 400 }
          );
        }
      }
      values[cellKey(String(row.sales_exec_code), row.model)] = String(
        parseUnits(row.target_units)
      );
    }

    const status = computeExecAllocationStatus({
      values,
      models,
      executives,
    });

    if (status.hasOver) {
      return NextResponse.json(
        {
          error: "One or more models are over-allocated versus the office target.",
          modelStatuses: status.modelStatuses,
        },
        { status: 400 }
      );
    }

    if (markComplete && !status.isFullyAllocated) {
      return NextResponse.json(
        {
          error:
            "All models must exactly match office targets before marking allocation complete.",
          modelStatuses: status.modelStatuses,
        },
        { status: 400 }
      );
    }

    const leafStatus = markComplete ? "completed" : "draft";
    const savedIds = [];

    // Upsert every exec×model cell for this office (zeros included to clear stale values)
    for (const exec of executives) {
      for (const m of models) {
        const units = parseUnits(values[cellKey(exec.id, m.model)]);
        const row = {
          sales_group: salesGroup,
          sales_office: salesOffice,
          sales_exec_code: exec.id,
          sales_exec_name: exec.name,
          brand: m.brand,
          model: m.model,
          article_code: null,
          target_units: units,
        };

        const existing = await findLeaf(supabase, periodId, row);
        if (existing?.id) {
          if (units <= 0) {
            await supabase.from("sales_exec_targets").delete().eq("id", existing.id);
            continue;
          }
          const { error } = await supabase
            .from("sales_exec_targets")
            .update({
              target_units: units,
              sales_exec_name: exec.name,
              status: leafStatus,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          savedIds.push(existing.id);
        } else if (units > 0) {
          const { data: inserted, error } = await supabase
            .from("sales_exec_targets")
            .insert({
              planning_period_id: periodId,
              ...row,
              status: leafStatus,
              created_by: user.id,
              updated_by: user.id,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          savedIds.push(inserted.id);
        }
      }
    }

    // No legacy flat sync needed — reconciliation reads sales_exec_targets

    let planStatus = period.status;
    let reconciliation = null;

    if (markComplete) {
      const {
        calculateReconciliation,
        applyReconciliationResult,
      } = await import("@/lib/reconciliation");

      const result = await calculateReconciliation(supabase, periodId);
      reconciliation = result;

      if (result.allOfficesComplete) {
        // All NPM office leaves match exec totals → auto-reconcile to completed / failed
        planStatus = await applyReconciliationResult(supabase, {
          periodId,
          userId: user.id,
          result,
        });
      } else {
        // This office is done; other offices still need BM allocation — keep editable
        planStatus = "retail_allocation";
        await supabase
          .from("planning_periods")
          .update({ status: planStatus, updated_at: new Date().toISOString() })
          .eq("id", periodId);
      }
    }

    await logAudit(supabase, {
      userId: user.id,
      action: markComplete ? "complete_executive" : "updated",
      entityType: "sales_exec_targets",
      entityId: periodId,
      details: {
        sales_office: salesOffice,
        sales_group: salesGroup,
        saved: savedIds.length,
        allocated: status.allocatedTotal,
        office_total: status.officeTotal,
        mark_complete: markComplete,
        reconciliation: reconciliation
          ? {
              passed: reconciliation.passed,
              allOfficesComplete: reconciliation.allOfficesComplete,
              incompleteOffices: reconciliation.incompleteOffices,
              dsSum: reconciliation.dsSum,
              npmSum: reconciliation.npmSum,
              execSum: reconciliation.execSum,
            }
          : null,
      },
      planningPeriodId: periodId,
    });

    return NextResponse.json({
      success: true,
      savedCount: savedIds.length,
      status,
      planStatus,
      reconciliation,
    });
  } catch (err) {
    return NextResponse.json(
      { error: formatSalesExecTargetsError(err) },
      { status: 500 }
    );
  }
}

