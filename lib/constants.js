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
  submitted_b2b: "Pending B2B Review",
  b2b_changes_requested: "B2B Changes Requested",
  b2b_approved: "B2B Approved",
  submitted_md: "Pending MD Approval",
  md_changes_requested: "MD Changes Requested",
  md_approved: "Approved",
  finalized: "Finalized",
  retail_allocation: "Sales Office Allocation",
  executive_allocation: "Executive Allocation",
  reconciliation_failed: "Reconciliation Failed",
  completed: "Completed",
};

export const DEMAND_SUPPLY_WORKFLOW_STEPS = [
  { key: "plan", label: "Monthly Target Plan", path: "/monthly-target-plans" },
  { key: "targets", label: "Target Creation", path: "/targets" },
  { key: "models", label: "Model Allocation", path: "/model-allocations" },
  { key: "articles", label: "Article Allocation", path: "/article-allocations" },
  { key: "review", label: "Review & Submit", path: "/workflow-status" },
];

export const WORKFLOW_PIPELINE = [
  { key: "draft", label: "Draft" },
  { key: "submitted_b2b", label: "B2B Review" },
  { key: "submitted_md", label: "MD Approval" },
  { key: "finalized", label: "Finalized" },
  { key: "retail_allocation", label: "Sales Office Allocation" },
  { key: "executive_allocation", label: "Executive Allocation" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "completed", label: "Completed" },
];

export {
  BRAND_MODELS,
  BRANDS,
  getModelsForBrand,
  isValidBrandModel,
  getArticleCodesForModel,
  isValidModelArticle,
  MASTER_DATA,
} from "@/lib/master-data";

export const SALES_GROUPS = [
  "Retail",
  "Fleet",
  "Corporate Fleet",
  "SME Fleet",
  "Government",
  "Institutional",
  "Special Sales",
];
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
