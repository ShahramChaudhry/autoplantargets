import { ROLE_LABELS } from "@/lib/constants";
import { formatPeriod } from "@/lib/utils";

function planName(period) {
  return period ? formatPeriod(period.month, period.year) : "Monthly Target Plan";
}

function describeActivity(log, period) {
  const details = log.details || {};
  const monthPlan = planName(period);

  if (log.action === "created" && log.entity_type === "targets" && details.brand) {
    return {
      headline: `Created ${details.brand} ${details.sales_group} Target`,
      subline: details.target_units != null ? `${details.target_units.toLocaleString()} units` : null,
    };
  }

  if (log.action === "created" && log.entity_type === "model_allocations" && details.model) {
    return {
      headline: `Added ${details.model} Allocation`,
      subline: details.units != null ? `${details.units.toLocaleString()} units` : null,
    };
  }

  if (log.action === "created" && log.entity_type === "article_allocations" && details.article_code) {
    return {
      headline: `Added ${details.article_code}`,
      subline: details.units != null ? `${details.units.toLocaleString()} units` : null,
    };
  }

  if (log.action === "created" && log.entity_type === "planning_period") {
    return { headline: `Opened ${monthPlan} Monthly Target Plan`, subline: null };
  }

  if (log.action === "updated" && details.model && details.from !== undefined && details.to !== undefined) {
    return {
      headline: `Updated ${details.model} Allocation`,
      subline: `Changed from ${details.from.toLocaleString()} units to ${details.to.toLocaleString()} units`,
    };
  }

  if (log.action === "updated" && details.article_code && details.from !== undefined && details.to !== undefined) {
    return {
      headline: `Updated ${details.article_code}`,
      subline: `Changed from ${details.from.toLocaleString()} units to ${details.to.toLocaleString()} units`,
    };
  }

  if (log.action === "updated" && details.brand && details.from !== undefined && details.to !== undefined) {
    return {
      headline: `Updated ${details.brand} ${details.sales_group} Target`,
      subline: `Changed from ${details.from.toLocaleString()} units to ${details.to.toLocaleString()} units`,
    };
  }

  if (log.action === "deleted" && details.model) {
    return {
      headline: `Removed ${details.model} Allocation`,
      subline: details.units != null ? `${details.units.toLocaleString()} units removed` : null,
    };
  }

  if (log.action === "deleted" && details.article_code) {
    return {
      headline: `Removed ${details.article_code}`,
      subline: details.units != null ? `${details.units.toLocaleString()} units removed` : null,
    };
  }

  if (log.action === "deleted" && details.brand) {
    return {
      headline: `Removed ${details.brand} ${details.sales_group} Target`,
      subline: details.units != null ? `${details.units.toLocaleString()} units removed` : null,
    };
  }

  if (log.action === "submit_b2b" || (log.action === "submitted" && details.to === "submitted_b2b")) {
    return { headline: `Submitted ${monthPlan} for Review`, subline: null };
  }

  if (log.action === "b2b_approve") {
    return { headline: `Approved ${monthPlan}`, subline: "Forwarded to MD Review" };
  }

  if (log.action === "b2b_request_changes") {
    return { headline: "Requested Changes", subline: `${monthPlan} returned to Demand & Supply` };
  }

  if (log.action === "md_approve") {
    return { headline: `Approved ${monthPlan}`, subline: null };
  }

  if (log.action === "md_request_changes") {
    return { headline: "Requested Changes", subline: `${monthPlan} returned to Demand & Supply` };
  }

  if (log.action === "complete_retail_allocation" || log.action === "start_retail") {
    const officeCount = details.office_count;
    const allocated = details.allocated;
    const officeLabel =
      officeCount != null && allocated != null
        ? `Allocated ${allocated.toLocaleString()} units across ${officeCount} sales office${officeCount === 1 ? "" : "s"}`
        : null;
    return {
      headline: "Completed Retail Allocation",
      subline: officeLabel,
    };
  }

  if (log.action === "finalize" || details.to === "finalized") {
    return {
      headline: `Finalized ${monthPlan}`,
      subline: "Released for Sales Office Allocation",
    };
  }

  if (log.action === "created" && log.entity_type === "sales_office_allocations" && details.sales_office) {
    return {
      headline: `Allocated ${details.units?.toLocaleString()} units to ${details.sales_office}`,
      subline: null,
    };
  }

  if (log.action === "updated" && log.entity_type === "sales_office_allocations" && details.sales_office) {
    return {
      headline: `Updated ${details.sales_office} allocation`,
      subline:
        details.from !== undefined && details.to !== undefined
          ? `Changed from ${details.from.toLocaleString()} units to ${details.to.toLocaleString()} units`
          : null,
    };
  }

  if (log.action === "deleted" && log.entity_type === "sales_office_allocations" && details.sales_office) {
    return {
      headline: `Removed ${details.sales_office} allocation`,
      subline: details.units != null ? `${details.units.toLocaleString()} units removed` : null,
    };
  }

  if (log.action === "allocated" && details.sales_office) {
    return {
      headline: `Allocated ${details.units?.toLocaleString()} units to ${details.sales_office}`,
      subline: null,
    };
  }

  if (log.action === "allocated" && details.sales_executive) {
    return {
      headline: `Allocated ${details.units?.toLocaleString()} units to ${details.sales_executive}`,
      subline: null,
    };
  }

  if (log.action === "reconciliation_failed") {
    return { headline: `Flagged reconciliation issue on ${monthPlan}`, subline: null };
  }

  return { headline: `Updated ${monthPlan}`, subline: null };
}

export function formatAuditEntry(log, period) {
  const { headline, subline } = describeActivity(log, period);

  return {
    id: log.id,
    userName: log.users?.name || "System",
    role: ROLE_LABELS[log.users?.role] || "",
    headline,
    subline,
    timestamp: log.created_at,
    comment: log.details?.comment || null,
  };
}
