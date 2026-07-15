import { formatPeriod } from "@/lib/utils";

export const PLANNING_BASE = "/monthly-planning";

export function planSlug(month, year) {
  const date = new Date(year, month - 1, 1);
  return date
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function planLabel(month, year) {
  return formatPeriod(month, year);
}

export function planWorkspacePath(month, year) {
  return `${PLANNING_BASE}/${planSlug(month, year)}`;
}

export function planQuery(month, year) {
  return `plan=${planSlug(month, year)}`;
}

export function planTargetsPath(month, year) {
  return planStepPath("targets", month, year);
}

/**
 * Build a path for a planning workflow step.
 * Accepts either a step key ("targets") or a legacy path ("/targets").
 */
export function planStepPath(stepOrPath, month, year) {
  const slug = planSlug(month, year);
  const key = normalizeStepKey(stepOrPath);

  if (key === "plan") {
    return `${PLANNING_BASE}/${slug}`;
  }

  return `${PLANNING_BASE}/${slug}?step=${key}`;
}

const LEGACY_PATH_TO_STEP = {
  "/monthly-target-plans": "targets",
  "/monthly-planning": "targets",
  "/targets": "targets",
  "/model-allocations": "targets",
  "/article-allocations": "targets",
  "/workflow-status": "submit",
  "/review": "submit",
};

export function normalizeStepKey(stepOrPath) {
  if (!stepOrPath) return "plan";
  if (stepOrPath.startsWith("/")) {
    return LEGACY_PATH_TO_STEP[stepOrPath] || "plan";
  }
  return stepOrPath;
}

export function findPlanBySlug(periods, slug) {
  if (!slug) return null;
  return periods.find((p) => planSlug(p.month, p.year) === slug) || null;
}

export function isArticleAllocationSkipped(plan) {
  return Boolean(plan?.article_allocation_skipped);
}

export function isArticleAllocationComplete(plan, articleCount = 0) {
  if (isArticleAllocationSkipped(plan)) return false;
  return articleCount > 0;
}
