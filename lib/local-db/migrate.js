/**
 * Migrates an existing local DB payload to the current schema shape.
 * Mutates and returns the same db object.
 */
export function migrateLocalDb(db) {
  for (const period of db.planning_periods || []) {
    if (typeof period.article_allocation_skipped !== "boolean") {
      period.article_allocation_skipped = false;
    }
  }

  // Drop removed IT Administrator accounts from older local DBs
  if (Array.isArray(db.users)) {
    db.users = db.users.filter(
      (u) => u.role !== "it_admin" && u.email !== "itadmin@autoplan.com"
    );
  }

  return db;
}
