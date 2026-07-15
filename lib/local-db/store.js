import { promises as fs } from "fs";
import path from "path";
import { createSeedDatabase } from "./seed";
import { migrateLocalDb } from "./migrate";

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
    globalThis[GLOBAL_KEY] = { cache: null, writeQueue: Promise.resolve() };
  }
  return globalThis[GLOBAL_KEY];
}

async function ensureDb() {
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
  mem.writeQueue = mem.writeQueue.then(async () => {
    mem.cache = structuredClone(next);
    const dbPath = getDbPath();
    try {
      if (!isServerless()) {
        await fs.mkdir(path.dirname(dbPath), { recursive: true });
      }
      await fs.writeFile(dbPath, JSON.stringify(next, null, 2), "utf8");
    } catch {
      // Keep in-memory copy even if persistence fails
    }
  });
  await mem.writeQueue;
}

export async function mutateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export function resetMemoryCache() {
  const mem = getMemory();
  mem.cache = null;
}

export { getDbPath as DB_PATH };
