import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/workflow";

const TABLE_MAP = {
  targets: "targets",
  models: "model_allocations",
  articles: "article_allocations",
  offices: "sales_office_allocations",
  executives: "executive_allocations",
};

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
  const { data: row, error } = await supabase.from(table).insert(data).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: "created",
    entityType: table,
    entityId: row.id,
    details: data,
    planningPeriodId: periodId,
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
    details: data,
    planningPeriodId: periodId,
  });

  return NextResponse.json({ success: true, data: row });
}
