import { ROLES } from "@/lib/constants";

const DEMAND = "11111111-1111-1111-1111-111111111101";
const B2B = "11111111-1111-1111-1111-111111111102";
const MD = "11111111-1111-1111-1111-111111111103";
const NPM = "11111111-1111-1111-1111-111111111104";
const BM = "11111111-1111-1111-1111-111111111105";

export function createSeedDatabase() {
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: DEMAND,
        name: "Demand & Supply Team",
        email: "demand@autoplan.com",
        password: "password123",
        role: ROLES.DEMAND_SUPPLY,
        created_at: now,
      },
      {
        id: B2B,
        name: "B2B Director",
        email: "b2bdirector@autoplan.com",
        password: "password123",
        role: ROLES.B2B_DIRECTOR,
        created_at: now,
      },
      {
        id: MD,
        name: "Managing Director",
        email: "md@autoplan.com",
        password: "password123",
        role: ROLES.MANAGING_DIRECTOR,
        created_at: now,
      },
      {
        id: NPM,
        name: "National Performance Manager",
        email: "npm@autoplan.com",
        password: "password123",
        role: ROLES.NPM,
        created_at: now,
      },
      {
        id: BM,
        name: "Branch Manager",
        email: "branchmanager@autoplan.com",
        password: "password123",
        role: ROLES.BRANCH_MANAGER,
        created_at: now,
      },
    ],
    // Start empty — D&S creates plans as needed (avoids May–Sep clutter)
    planning_periods: [],
    targets: [],
    model_allocations: [],
    article_allocations: [],
    sales_office_allocations: [],
    executive_allocations: [],
    sales_exec_targets: [],
    notifications: [],
    audit_logs: [],
  };
}
