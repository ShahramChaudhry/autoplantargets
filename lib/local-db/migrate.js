/**
 * Migrates an existing local DB payload to the current schema shape.
 * Mutates and returns the same db object.
 */
export function migrateLocalDb(db) {
  const now = new Date().toISOString();

  for (const period of db.planning_periods || []) {
    if (typeof period.article_allocation_skipped !== "boolean") {
      period.article_allocation_skipped = false;
    }
  }

  const hasIT = (db.users || []).some((u) => u.role === "it_admin" || u.email === "itadmin@autoplan.com");
  if (!hasIT) {
    db.users = db.users || [];
    db.users.push({
      id: "11111111-1111-1111-1111-111111111106",
      name: "IT Administrator",
      email: "itadmin@autoplan.com",
      password: "password123",
      role: "it_admin",
      created_at: now,
    });
  }

  return db;
}
