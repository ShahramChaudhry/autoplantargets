import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/workflow";
import { validateModelAllocation } from "@/lib/model-allocation";
import { validateArticleAllocation, validateArticleUnitsUpdate } from "@/lib/article-allocation";
import { assertPlanEditable } from "@/lib/plan-editability";
import {
  assertRetailAllocationEditable,
  isExecutiveAllocationAllowed,
  EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE,
} from "@/lib/retail-allocation";
import { ROLES } from "@/lib/constants";

const TABLE_MAP = {
  targets: "targets",
  models: "model_allocations",
  articles: "article_allocations",
  offices: "sales_office_allocations",
  executives: "executive_allocations",
};

const DEMAND_SUPPLY_TYPES = ["targets", "models", "articles"];

async function fetchExisting(supabase, type, id) {
  const table = TABLE_MAP[type];
  const { data } = await supabase.from(table).select("*").eq("id", id).single();
  return data;
}

function buildAuditDetails(type, action, existing, data) {
  if (type === "targets") {
    if (action === "created") {
      return {
        brand: data.brand,
        sales_group: data.sales_group,
        target_units: data.target_units,
      };
    }
    if (action === "updated" && data.target_units !== undefined) {
      return {
        brand: existing.brand,
        sales_group: existing.sales_group,
        from: existing.target_units,
        to: data.target_units,
      };
    }
    if (action === "deleted") {
      return {
        brand: existing.brand,
        sales_group: existing.sales_group,
        units: existing.target_units,
      };
    }
  }

  if (type === "models") {
    if (action === "created") {
      return { model: data.model, units: data.units };
    }
    if (action === "updated" && data.units !== undefined) {
      return { model: existing.model, from: existing.units, to: data.units };
    }
    if (action === "deleted") {
      return { model: existing.model, units: existing.units };
    }
  }

  if (type === "articles") {
    if (action === "created") {
      return { article_code: data.article_code, units: data.units };
    }
    if (action === "updated" && data.units !== undefined) {
      return { article_code: existing.article_code, from: existing.units, to: data.units };
    }
    if (action === "deleted") {
      return { article_code: existing.article_code, units: existing.units };
    }
  }

  if (type === "offices") {
    if (action === "created") {
      return { sales_office: data.sales_office, units: data.units };
    }
    if (action === "updated" && data.units !== undefined) {
      return { sales_office: existing.sales_office, from: existing.units, to: data.units };
    }
    if (action === "deleted") {
      return { sales_office: existing.sales_office, units: existing.units };
    }
  }

  return data;
}

async function guardMutation(user, supabase, { type, periodId, data, id, existing }) {
  if (DEMAND_SUPPLY_TYPES.includes(type) && user.role !== ROLES.DEMAND_SUPPLY) {
    return { error: "Not permitted" };
  }

  if (DEMAND_SUPPLY_TYPES.includes(type)) {
    const editCheck = await assertPlanEditable(supabase, { type, periodId, data, id });
    if (editCheck.error) {
      return { error: editCheck.error };
    }
    return { period: editCheck.period };
  }

  if (type === "offices") {
    if (user.role !== ROLES.NPM) {
      return { error: "Not permitted" };
    }

    const resolvedPeriodId = periodId || existing?.planning_period_id;
    const editCheck = await assertRetailAllocationEditable(supabase, resolvedPeriodId);
    if (editCheck.error) {
      return { error: editCheck.error };
    }
    return { period: editCheck.period };
  }

  if (type === "executives") {
    if (user.role !== ROLES.BRANCH_MANAGER) {
      return { error: "Not permitted" };
    }

    const resolvedPeriodId = periodId;
    if (!resolvedPeriodId && (existing?.sales_office_allocation_id || data?.sales_office_allocation_id)) {
      const officeId = existing?.sales_office_allocation_id || data?.sales_office_allocation_id;
      const { data: office } = await supabase
        .from("sales_office_allocations")
        .select("planning_period_id")
        .eq("id", officeId)
        .single();
      if (office?.planning_period_id) {
        const { data: period } = await supabase
          .from("planning_periods")
          .select("id, status, month, year")
          .eq("id", office.planning_period_id)
          .single();
        if (!period) {
          return { error: "Plan not found" };
        }
        if (!isExecutiveAllocationAllowed(period.status)) {
          return { error: EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE };
        }
        return { period };
      }
    }

    if (!resolvedPeriodId) {
      return { error: "Plan not found" };
    }

    const { data: period } = await supabase
      .from("planning_periods")
      .select("id, status, month, year")
      .eq("id", resolvedPeriodId)
      .single();

    if (!period) {
      return { error: "Plan not found" };
    }

    if (!isExecutiveAllocationAllowed(period.status)) {
      return { error: EXECUTIVE_ALLOCATION_BLOCKED_MESSAGE };
    }

    return { period };
  }

  return {};
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, data, periodId } = body;
  const table = TABLE_MAP[type];

  if (!table) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const supabase = await createClient();
  const guard = await guardMutation(user, supabase, { type, periodId, data });
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.error === "Not permitted" ? 403 : 400 });
  }

  if (type === "models") {
    const validation = await validateModelAllocation(supabase, {
      targetId: data.target_id,
      model: data.model,
      units: data.units,
    });
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  if (type === "articles") {
    const validation = await validateArticleAllocation(supabase, {
      modelAllocationId: data.model_allocation_id,
      articleCode: data.article_code,
      units: data.units,
    });
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  if (type === "offices") {
    if (!periodId) {
      return NextResponse.json({ error: "Monthly target plan is required" }, { status: 400 });
    }
    data.planning_period_id = periodId;
  }

  const { data: row, error } = await supabase.from(table).insert(data).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: type === "offices" ? "allocated" : "created",
    entityType: table,
    entityId: row.id,
    details: buildAuditDetails(type, "created", null, data),
    planningPeriodId: periodId || guard.period?.id,
  });

  return NextResponse.json({ success: true, data: row });
}

export async function PATCH(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, id, data, periodId } = await request.json();
  const table = TABLE_MAP[type];

  if (!table) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const supabase = await createClient();
  const existing = await fetchExisting(supabase, type, id);

  if (!existing) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const guard = await guardMutation(user, supabase, { type, periodId, data, id, existing });
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.error === "Not permitted" ? 403 : 400 });
  }

  if (type === "models" && data.units !== undefined) {
    const validation = await validateModelAllocation(supabase, {
      targetId: existing.target_id,
      model: existing.model,
      units: data.units,
      excludeId: id,
    });
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  if (type === "articles" && data.units !== undefined) {
    const validation = await validateArticleUnitsUpdate(supabase, {
      articleId: id,
      units: data.units,
    });
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const { data: row, error } = await supabase
    .from(table)
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: "updated",
    entityType: table,
    entityId: id,
    details: buildAuditDetails(type, "updated", existing, data),
    planningPeriodId: periodId || guard.period?.id,
  });

  return NextResponse.json({ success: true, data: row });
}

export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const periodId = searchParams.get("periodId");
  const table = TABLE_MAP[type];

  if (!table || !id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const existing = await fetchExisting(supabase, type, id);

  if (!existing) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const guard = await guardMutation(user, supabase, { type, periodId, id, existing });
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.error === "Not permitted" ? 403 : 400 });
  }

  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: "deleted",
    entityType: table,
    entityId: id,
    details: buildAuditDetails(type, "deleted", existing, null),
    planningPeriodId: periodId || guard.period?.id,
  });

  return NextResponse.json({ success: true });
}
