import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createLocalClient } from "@/lib/local-db/query";
import { SESSION_COOKIE, decodeSession } from "@/lib/local-db/session";

/**
 * Prefer real Supabase when configured (durable on Vercel).
 * Falls back to in-process local DB for offline / pure local MVP.
 *
 * Set either:
 *   SUPABASE_SERVICE_ROLE_KEY  (recommended — bypasses RLS)
 *   USE_SUPABASE=true          (uses anon key; requires mvp-anon-access migration)
 */
export function shouldUseSupabaseBackend() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !(serviceKey || anonKey)) return false;
  if (serviceKey) return true;

  const flag = String(process.env.USE_SUPABASE || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (flag === "true" || flag === "1") return true;

  // Auto-enable when Supabase credentials are present (Vercel + local)
  return Boolean(url && anonKey);
}

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = decodeSession(token);

  if (shouldUseSupabaseBackend()) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return createSupabaseJsClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return createLocalClient(session?.id || null);
}
