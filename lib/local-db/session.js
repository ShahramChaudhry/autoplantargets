export const SESSION_COOKIE = "autoplan_session";

export function encodeSession(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeSession(token) {
  if (!token) return null;
  try {
    let json;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(token, "base64url").toString("utf8");
    } else {
      const padded = token.replace(/-/g, "+").replace(/_/g, "/");
      json = decodeURIComponent(escape(atob(padded)));
    }
    const data = JSON.parse(json);
    if (!data?.id || !data?.role) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}
