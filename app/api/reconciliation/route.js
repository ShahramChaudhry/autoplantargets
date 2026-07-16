import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateReconciliation,
  applyReconciliationResult,
} from "@/lib/reconciliation";
import { ROLES } from "@/lib/constants";

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (![ROLES.BRANCH_MANAGER, ROLES.NPM].includes(user.role)) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { periodId } = await request.json();
  if (!periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await calculateReconciliation(supabase, periodId);
  const newStatus = await applyReconciliationResult(supabase, {
    periodId,
    userId: user.id,
    result,
  });

  return NextResponse.json({ ...result, status: newStatus });
}
