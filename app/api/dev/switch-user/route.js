import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SEED_USERS } from "@/lib/constants";

export async function POST(request) {
  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return NextResponse.json({ error: "Dev mode is disabled" }, { status: 403 });
  }

  const { email } = await request.json();
  const user = SEED_USERS.find((u) => u.email === email);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, email: user.email });
}
