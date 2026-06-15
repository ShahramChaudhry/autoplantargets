import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { logAudit } from "@/lib/workflow";
import { planSlug } from "@/lib/plans";

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== ROLES.DEMAND_SUPPLY) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { month, year } = await request.json();
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (!monthNum || monthNum < 1 || monthNum > 12 || !yearNum || yearNum < 2020) {
    return NextResponse.json({ error: "Please select a valid month and year" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("planning_periods")
    .select("id")
    .eq("month", monthNum)
    .eq("year", yearNum)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A monthly target plan already exists for this month and year" },
      { status: 409 }
    );
  }

  const { data: plan, error } = await supabase
    .from("planning_periods")
    .insert({ month: monthNum, year: yearNum, status: "draft" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: user.id,
    action: "created",
    entityType: "planning_period",
    entityId: plan.id,
    details: { month: monthNum, year: yearNum },
    planningPeriodId: plan.id,
  });

  return NextResponse.json({
    success: true,
    plan,
    slug: planSlug(monthNum, yearNum),
  });
}
