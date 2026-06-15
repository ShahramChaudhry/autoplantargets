import { formatPeriod } from "@/lib/utils";

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
  return `/monthly-target-plans/${planSlug(month, year)}`;
}

export function planQuery(month, year) {
  return `plan=${planSlug(month, year)}`;
}

export function planTargetsPath(month, year) {
  return `/targets?plan=${planSlug(month, year)}`;
}

export function planStepPath(stepPath, month, year) {
  const slug = planSlug(month, year);
  if (stepPath === "/monthly-target-plans") {
    return `/monthly-target-plans/${slug}`;
  }
  return `${stepPath}?plan=${slug}`;
}

export function findPlanBySlug(periods, slug) {
  if (!slug) return null;
  return periods.find((p) => planSlug(p.month, p.year) === slug) || null;
}
