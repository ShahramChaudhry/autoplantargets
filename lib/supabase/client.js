"use client";

/**
 * Browser client — auth goes through local API routes.
 * Table access from the browser is not used; pages use server components / API routes.
 */
export function createClient() {
  return {
    auth: {
      async signInWithPassword({ email, password }) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { data: { user: null, session: null }, error: { message: data.error || "Login failed" } };
        }
        return { data: { user: data.user, session: data.session }, error: null };
      },
      async signOut() {
        await fetch("/api/auth/logout", { method: "POST" });
        return { error: null };
      },
      async getUser() {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return { data: { user: null }, error: null };
        const data = await res.json();
        return { data: { user: data.user }, error: null };
      },
    },
  };
}
