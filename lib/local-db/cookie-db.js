import { gzipSync, gunzipSync } from "zlib";
import { createSeedDatabase } from "./seed";
import { migrateLocalDb } from "./migrate";

export const DB_COOKIE_PREFIX = "autoplan_db";
export const DB_COOKIE_COUNT = "autoplan_db_n";
const CHUNK_SIZE = 3500;

const OVERLAY_KEYS = [
  "planning_periods",
  "targets",
  "model_allocations",
  "article_allocations",
  "sales_office_allocations",
  "executive_allocations",
  "notifications",
  "audit_logs",
];

function cookieOptions(maxAge = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    maxAge,
  };
}

export function extractOverlay(db) {
  const overlay = {};
  for (const key of OVERLAY_KEYS) {
    if (key === "audit_logs") {
      overlay[key] = (db[key] || []).slice(-80);
    } else {
      overlay[key] = db[key] || [];
    }
  }
  overlay.updated_at = db.updated_at || new Date().toISOString();
  return overlay;
}

export function encodeOverlay(overlay) {
  const json = JSON.stringify(overlay);
  return gzipSync(json).toString("base64url");
}

export function decodeOverlay(encoded) {
  if (!encoded) return null;
  try {
    const json = gunzipSync(Buffer.from(encoded, "base64url")).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function mergeById(seedRows, overlayRows) {
  const map = new Map();
  for (const row of seedRows || []) map.set(row.id, row);
  for (const row of overlayRows || []) map.set(row.id, { ...map.get(row.id), ...row });
  return [...map.values()];
}

export function mergeOverlayIntoDb(overlay) {
  const seed = createSeedDatabase();
  if (!overlay) return migrateLocalDb(seed);

  return migrateLocalDb({
    ...seed,
    users: seed.users,
    planning_periods: mergeById(seed.planning_periods, overlay.planning_periods),
    targets: overlay.targets || [],
    model_allocations: overlay.model_allocations || [],
    article_allocations: overlay.article_allocations || [],
    sales_office_allocations: overlay.sales_office_allocations || [],
    executive_allocations: overlay.executive_allocations || [],
    notifications: overlay.notifications || [],
    audit_logs: overlay.audit_logs || [],
    updated_at: overlay.updated_at,
  });
}

export function readOverlayFromCookies(cookieStore) {
  if (!cookieStore) return null;
  const countRaw = cookieStore.get(DB_COOKIE_COUNT)?.value;
  if (!countRaw) {
    // Legacy single-cookie format
    const single = cookieStore.get(DB_COOKIE_PREFIX)?.value;
    return decodeOverlay(single);
  }

  const count = parseInt(countRaw, 10);
  if (!Number.isFinite(count) || count <= 0 || count > 40) return null;

  let encoded = "";
  for (let i = 0; i < count; i++) {
    const part = cookieStore.get(`${DB_COOKIE_PREFIX}_${i}`)?.value;
    if (!part) return null;
    encoded += part;
  }
  return decodeOverlay(encoded);
}

export function writeOverlayToCookies(cookieStore, db) {
  if (!cookieStore) return;

  const encoded = encodeOverlay(extractOverlay(db));
  const opts = cookieOptions();

  // Clear previous chunks (up to a safe bound)
  const previous = parseInt(cookieStore.get(DB_COOKIE_COUNT)?.value || "0", 10);
  for (let i = 0; i < Math.max(previous, 40); i++) {
    cookieStore.delete(`${DB_COOKIE_PREFIX}_${i}`);
  }
  cookieStore.delete(DB_COOKIE_PREFIX);

  if (!encoded) return;

  const chunks = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
    chunks.push(encoded.slice(i, i + CHUNK_SIZE));
  }

  cookieStore.set(DB_COOKIE_COUNT, String(chunks.length), opts);
  chunks.forEach((chunk, i) => {
    cookieStore.set(`${DB_COOKIE_PREFIX}_${i}`, chunk, opts);
  });
}
