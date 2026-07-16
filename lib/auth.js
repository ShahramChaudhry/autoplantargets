import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { readDb } from "@/lib/local-db/store";
import { SESSION_COOKIE, decodeSession } from "@/lib/local-db/session";
import {
  ROUTE_PERMISSIONS,
  canAccessRoute,
  getHomePathForRole,
} from "@/lib/route-permissions";

export { ROUTE_PERMISSIONS, canAccessRoute, getHomePathForRole };

export async function getCurrentUser() {
  noStore();
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session?.id) return null;

  const db = await readDb();
  const user = db.users.find((u) => u.id === session.id);
  if (!user) return null;

  const { password: _password, ...profile } = user;
  return profile;
}

export async function requirePageAccess(pathname) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!canAccessRoute(user.role, pathname)) {
    redirect(getHomePathForRole(user.role));
  }

  return user;
}
