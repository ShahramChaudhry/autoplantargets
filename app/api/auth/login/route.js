import { NextResponse } from "next/server";
import { readDb } from "@/lib/local-db/store";
import {
  SESSION_COOKIE,
  encodeSession,
  sessionCookieOptions,
} from "@/lib/local-db/session";

export async function POST(request) {
  const { email, password } = await request.json();
  const db = await readDb();
  const user = db.users.find(
    (u) => u.email?.toLowerCase() === String(email || "").toLowerCase()
  );

  if (!user || user.password !== password) {
    return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
  }

  const { password: _pw, ...safeUser } = user;
  const response = NextResponse.json({
    success: true,
    user: safeUser,
    session: { user: safeUser },
  });

  response.cookies.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());
  return response;
}
