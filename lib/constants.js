export const ROLES = {
  DEMAND_SUPPLY: "demand_supply",
  B2B_DIRECTOR: "b2b_director",
  MANAGING_DIRECTOR: "managing_director",
  NPM: "national_performance_manager",
  BRANCH_MANAGER: "branch_manager",
};

export const ROLE_LABELS = {
  demand_supply: "Demand & Supply Team",
  b2b_director: "B2B Director",
  managing_director: "Managing Director",
  national_performance_manager: "National Performance Manager / Retail Head",
  branch_manager: "Branch Manager",
};

export const STATUS_LABELS = {
  draft: "Draft",
  submitted_b2b: "Submitted for B2B Review",
  b2b_changes_requested: "B2B Changes Requested",
  b2b_approved: "B2B Approved",
  submitted_md: "Submitted for MD Review",
  md_changes_requested: "MD Changes Requested",
  md_approved: "MD Approved",
  finalized: "Finalized",
  retail_allocation: "Retail Allocation",
  executive_allocation: "Executive Allocation",
  reconciliation_failed: "Reconciliation Failed",
  completed: "Completed",
};

export const WORKFLOW_STEPS = [
  { key: "draft", label: "Create Targets", roles: [ROLES.DEMAND_SUPPLY] },
  { key: "submitted_b2b", label: "B2B Review", roles: [ROLES.B2B_DIRECTOR] },
  { key: "submitted_md", label: "MD Review", roles: [ROLES.MANAGING_DIRECTOR] },
  { key: "finalized", label: "Finalize", roles: [ROLES.DEMAND_SUPPLY] },
  { key: "retail_allocation", label: "Sales Office Allocation", roles: [ROLES.NPM] },
  { key: "executive_allocation", label: "Executive Allocation", roles: [ROLES.BRANCH_MANAGER] },
  { key: "completed", label: "Reconciliation", roles: [ROLES.BRANCH_MANAGER, ROLES.NPM] },
];

export const BRANDS = ["Toyota", "Lexus", "Honda"];
export const SALES_GROUPS = ["Retail", "Fleet", "Corporate Fleet"];
export const MODELS = ["Corolla", "Camry", "Prado", "Civic", "Accord"];
export const SALES_OFFICES = ["Dubai", "Abu Dhabi", "Sharjah"];
export const SALES_EXECUTIVES = [
  "Ahmed Hassan",
  "Sarah Khan",
  "John Mathew",
  "Ali Raza",
  "Fatima Noor",
];

export const SEED_USERS = [
  { email: "demand@autoplan.com", password: "password123", role: ROLES.DEMAND_SUPPLY, name: "Demand & Supply Team" },
  { email: "b2bdirector@autoplan.com", password: "password123", role: ROLES.B2B_DIRECTOR, name: "B2B Director" },
  { email: "md@autoplan.com", password: "password123", role: ROLES.MANAGING_DIRECTOR, name: "Managing Director" },
  { email: "npm@autoplan.com", password: "password123", role: ROLES.NPM, name: "National Performance Manager" },
  { email: "branchmanager@autoplan.com", password: "password123", role: ROLES.BRANCH_MANAGER, name: "Branch Manager" },
];
