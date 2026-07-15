import { cookies } from "next/headers";
import { createLocalClient } from "@/lib/local-db/query";
import { SESSION_COOKIE, decodeSession } from "@/lib/local-db/session";

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = decodeSession(token);
  return createLocalClient(session?.id || null);
}
