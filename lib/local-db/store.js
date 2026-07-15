import { promises as fs } from "fs";
import path from "path";
import { createSeedDatabase } from "./seed";
import { migrateLocalDb } from "./migrate";
import { mergeOverlayIntoDb, readOverlayFromCookies, writeOverlayToCookies } from "./cookie-db";

const GLOBAL_KEY = "__autoplan_local_db__";

function isServerless() {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function getDbPath() {
  // On Vercel the app filesystem is read-only; /tmp is writable per instance.
  if (isServerless()) {
    return path.join("/tmp", "autoplan-local-db.json");
  }
  return path.join(process.cwd(), "data", "local-db.json");
}

function getMemory() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = {
      cache: null,
      writeQueue: Promise.resolve(),
      cookieHydrated: false,
    };
  }
  return globalThis[GLOBAL_KEY];
}

async function getCookieStoreSafe() {
  try {
    const { cookies } = await import("next/headers");
    return await cookies();
  } catch {
    return null;
  }
}

/**
 * On Vercel, instance /tmp + memory are not shared. Persist mutable planning
 * data in httpOnly cookies so every serverless instance sees the same state.
 */
async function hydrateFromCookiesIfNeeded() {
  if (!isServerless()) return;

  const cookieStore = await getCookieStoreSafe();
  if (!cookieStore) return;

  const overlay = readOverlayFromCookies(cookieStore);
  if (!overlay) return;

  const mem = getMemory();
  const cookieTs = overlay.updated_at ? Date.parse(overlay.updated_at) : 0;
  const cacheTs = mem.cache?.updated_at ? Date.parse(mem.cache.updated_at) : 0;

  // Prefer cookie when missing cache, or when cookie is newer / equal (shared truth).
  if (!mem.cache || cookieTs >= cacheTs) {
    mem.cache = mergeOverlayIntoDb(overlay);
    mem.cookieHydrated = true;
  }
}

async function persistToCookies(db) {
  if (!isServerless()) return;
  const cookieStore = await getCookieStoreSafe();
  if (!cookieStore) return;
  try {
    writeOverlayToCookies(cookieStore, db);
  } catch {
    // cookies().set is only allowed in Server Actions / Route Handlers
  }
}

async function ensureDb() {
  await hydrateFromCookiesIfNeeded();

  const mem = getMemory();
  if (mem.cache) {
    migrateLocalDb(mem.cache);
    return mem.cache;
  }

  const dbPath = getDbPath();

  try {
    const raw = await fs.readFile(dbPath, "utf8");
    mem.cache = migrateLocalDb(JSON.parse(raw));
    return mem.cache;
  } catch {
    const seed = createSeedDatabase();
    mem.cache = seed;
    try {
      if (!isServerless()) {
        await fs.mkdir(path.dirname(dbPath), { recursive: true });
      }
      await fs.writeFile(dbPath, JSON.stringify(seed, null, 2), "utf8");
    } catch {
      // Memory-only fallback if disk write fails (some serverless edges)
    }
    return mem.cache;
  }
}

export async function readDb() {
  const db = await ensureDb();
  return structuredClone(db);
}

export async function writeDb(next) {
  const mem = getMemory();
  const stamped = {
    ...next,
    updated_at: new Date().toISOString(),
  };

  mem.writeQueue = mem.writeQueue.then(async () => {
    mem.cache = structuredClone(stamped);
    const dbPath = getDbPath();
    try {
      if (!isServerless()) {
        await fs.mkdir(path.dirname(dbPath), { recursive: true });
      }
      await fs.writeFile(dbPath, JSON.stringify(stamped, null, 2), "utf8");
    } catch {
      // Keep in-memory copy even if persistence fails
    }
  });
  await mem.writeQueue;
  await persistToCookies(mem.cache);
}

export async function mutateDb(mutator) {
  // Force cookie hydrate before mutating so we don't clobber shared state
  // with a stale empty instance cache.
  if (isServerless()) {
    const mem = getMemory();
    mem.cache = null;
    mem.cookieHydrated = false;
  }

  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export function resetMemoryCache() {
  const mem = getMemory();
  mem.cache = null;
  mem.cookieHydrated = false;
}

export { getDbPath as DB_PATH, isServerless };
