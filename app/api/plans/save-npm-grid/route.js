import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  isRetailAllocationEditable,
} from "@/lib/retail-allocation";
import { logAudit } from "@/lib/workflow";

/**
 * NPM saves Model × Sales Office splits.
 * - Writes office-scoped rows on `targets` (keeps D&S sales_office=null totals intact)
 * - Syncs aggregated office units into `sales_office_allocations` for Branch Manager
 */
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.NPM) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { periodId, salesGroup, targets = [] } = await request.json();
  if (!periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
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

  if (!isRetailAllocationEditable(period.status)) {
    return NextResponse.json(
      { error: "Sales office allocation is only available after the plan is finalized." },
      { status: 400 }
    );
  }

  try {
    const savedIds = [];
    const officeTotals = {};

    for (const row of targets) {
      const units = Number(row.target_units) || 0;
      if (!row.brand || !row.sales_group || !row.model || !row.sales_office) continue;

      const { data: existing } = await supabase
        .from("targets")
        .select("id")
        .eq("planning_period_id", periodId)
        .eq("brand", row.brand)
        .eq("sales_group", row.sales_group)
        .eq("model", row.model)
        .eq("sales_office", row.sales_office)
        .maybeSingle();

      if (existing?.id) {
        if (units <= 0) {
          await supabase.from("targets").delete().eq("id", existing.id);
          continue;
        }
        const { error } = await supabase
          .from("targets")
          .update({ target_units: units })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        savedIds.push(existing.id);
      } else if (units > 0) {
        const { data: inserted, error } = await supabase
          .from("targets")
          .insert({
            planning_period_id: periodId,
            brand: row.brand,
            sales_group: row.sales_group,
            model: row.model,
            sales_office: row.sales_office,
            target_units: units,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        savedIds.push(inserted.id);
      }

      if (units > 0) {
        officeTotals[row.sales_office] = (officeTotals[row.sales_office] || 0) + units;
      }
    }

    // For the sales group being edited, rebuild office aggregates from all office-scoped
    // targets in this group (not only the payload), then sync Retail into sales_office_allocations
    // when salesGroup is Retail; for other groups we only keep target rows.
    const { data: officeScoped } = await supabase
      .from("targets")
      .select("sales_office, target_units, sales_group")
      .eq("planning_period_id", periodId)
      .eq("sales_group", salesGroup || "Retail");

    const aggregated = {};
    for (const row of officeScoped || []) {
      if (!row.sales_office) continue;
      aggregated[row.sales_office] =
        (aggregated[row.sales_office] || 0) + (row.target_units || 0);
    }

    if ((salesGroup || "Retail") === "Retail") {
      const { data: existingOffices } = await supabase
        .from("sales_office_allocations")
        .select("id, sales_office")
        .eq("planning_period_id", periodId);

      const byName = Object.fromEntries(
        (existingOffices || []).map((o) => [o.sales_office, o.id])
      );

      for (const [officeName, units] of Object.entries(aggregated)) {
        const existingId = byName[officeName];
        if (existingId) {
          await supabase
            .from("sales_office_allocations")
            .update({ units })
            .eq("id", existingId);
        } else if (units > 0) {
          await supabase.from("sales_office_allocations").insert({
            planning_period_id: periodId,
            sales_office: officeName,
            units,
          });
        }
      }

      // Remove office allocations no longer present
      for (const row of existingOffices || []) {
        if (!aggregated[row.sales_office] || aggregated[row.sales_office] <= 0) {
          await supabase.from("sales_office_allocations").delete().eq("id", row.id);
        }
      }
    }

    await logAudit(supabase, {
      userId: user.id,
      action: "updated",
      entityType: "sales_office_allocations",
      entityId: periodId,
      details: {
        sales_group: salesGroup,
        saved: savedIds.length,
        offices: Object.keys(aggregated).length,
      },
      planningPeriodId: periodId,
    });

    return NextResponse.json({
      success: true,
      savedCount: savedIds.length,
      officeTotals: aggregated,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to save" }, { status: 500 });
  }
}
