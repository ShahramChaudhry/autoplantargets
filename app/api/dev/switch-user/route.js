import { NextResponse } from "next/server";
import { readDb } from "@/lib/local-db/store";
import {
  SESSION_COOKIE,
  encodeSession,
  sessionCookieOptions,
} from "@/lib/local-db/session";
import { SEED_USERS } from "@/lib/constants";

export async function POST(request) {
  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return NextResponse.json({ error: "Dev mode is disabled" }, { status: 403 });
  }

  const { email } = await request.json();
  const seed = SEED_USERS.find((u) => u.email === email);
  if (!seed) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const db = await readDb();
  const user = db.users.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({ error: "User not found in local database" }, { status: 404 });
  }

  const response = NextResponse.json({ success: true, email: user.email });
  response.cookies.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());
  return response;
}
