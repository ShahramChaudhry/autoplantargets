import { divisions } from "./divisions";
import { salesGroups } from "./salesGroups";
import { salesOffices } from "./salesOffices";
import { salesExecutives } from "./salesExecutives";
import { models } from "./models";
import { divisionGridConfig } from "./gridConfig";
import { getResponsibility } from "./responsibilities";

/**
 * Master-data accessors.
 * Swap implementations here later for Databricks / API calls —
 * React components should keep calling these helpers only.
 */

export function getDivisions() {
  return divisions;
}

export function getDivisionsForUser(user) {
  const scope = getResponsibility(user);
  if (scope.divisions === "all") return divisions;
  const allowed = new Set(scope.divisions || []);
  return divisions.filter((d) => allowed.has(d.name));
}

export function getDivisionById(id) {
  return divisions.find((d) => d.id === id) || null;
}

export function getDivisionByName(name) {
  return divisions.find((d) => d.name === name) || null;
}

export function getSalesGroups(_division) {
  return salesGroups;
}

/** Primary vehicle sales groups shown first in Target Entry for a simpler UI. */
export function getPrimarySalesGroups() {
  const preferred = ["001", "002", "014", "015", "021", "006"];
  const byCode = Object.fromEntries(salesGroups.map((g) => [g.code, g]));
  const primary = preferred.map((code) => byCode[code]).filter(Boolean);
  return primary.length ? primary : salesGroups.slice(0, 6);
}

export function getSalesGroupByCode(code) {
  return salesGroups.find((g) => g.code === code) || null;
}

export function getSalesGroupByName(name) {
  return salesGroups.find((g) => g.name === name) || null;
}

/** Normalize legacy string office values to { code, name, label }. */
export function normalizeOffice(office) {
  if (!office) return null;
  if (typeof office === "string") {
    for (const list of Object.values(salesOffices)) {
      const match = list.find((o) => o.name === office);
      if (match) return match;
    }
    return { code: office.slice(0, 4).toUpperCase(), name: office, label: office };
  }
  return office;
}

export function getOfficeName(office) {
  return normalizeOffice(office)?.name || office;
}

export function getOfficeCode(office) {
  return normalizeOffice(office)?.code || "";
}

export function getOfficeLabel(office) {
  const n = normalizeOffice(office);
  return n?.label || n?.name || office || "";
}

export function getSalesOffices(division) {
  const name = typeof division === "string" ? division : division?.name;
  return (salesOffices[name] || []).map(normalizeOffice);
}

/**
 * Sales offices visible to the current user for a division.
 * Demand & Supply / leadership see all; scoped users see only their territory.
 */
export function getSalesOfficesForUser(user, division) {
  const divisionName = typeof division === "string" ? division : division?.name;
  const all = getSalesOffices(divisionName);
  const scope = getResponsibility(user);

  if (scope.offices === "all" || !scope.offices) return all;

  const allowed = scope.offices[divisionName];
  if (!allowed) return [];
  if (allowed === "all") return all;
  return all.filter((office) => allowed.includes(office.name));
}

/** Union of offices across divisions (deduped by name) for multi-division grids. */
export function getUnionOfficesForUser(user, divisionList) {
  const seen = new Set();
  const result = [];
  for (const division of divisionList) {
    for (const office of getSalesOfficesForUser(user, division)) {
      if (!seen.has(office.name)) {
        seen.add(office.name);
        result.push(office);
      }
    }
  }
  return result;
}

export function getSalesExecutives(division, salesOffice) {
  const divisionName = typeof division === "string" ? division : division?.name;
  const officeName = getOfficeName(salesOffice);
  if (!divisionName || !officeName) return [];
  return salesExecutives[divisionName]?.[officeName] || [];
}

export function getModels(division, salesGroup) {
  const divisionName = typeof division === "string" ? division : division?.name;
  const groupName = typeof salesGroup === "string" ? salesGroup : salesGroup?.name;
  return models[divisionName]?.[groupName] || [];
}

export function getGridConfig(division) {
  const name = typeof division === "string" ? division : division?.name;
  return (
    divisionGridConfig[name] || {
      includeSalesOffices: false,
    }
  );
}

/**
 * Build target-entry grid rows for a Division + Sales Group.
 * Optional salesOffice scopes Model × Office layouts to one office.
 * Optional offices list overrides master office list (responsibility filter).
 */
export function buildTargetGridRows(division, salesGroup, salesOffice = null, officesOverride = null) {
  const divisionName = typeof division === "string" ? division : division?.name;
  const groupName = typeof salesGroup === "string" ? salesGroup : salesGroup?.name;
  const config = getGridConfig(divisionName);
  const modelList = getModels(divisionName, groupName);

  let offices;
  if (salesOffice) {
    offices = [normalizeOffice(salesOffice)];
  } else if (officesOverride) {
    offices = officesOverride.map(normalizeOffice);
  } else if (config.includeSalesOffices) {
    offices = getSalesOffices(divisionName);
  } else {
    offices = [null];
  }

  const rows = [];
  for (const model of modelList) {
    for (const office of offices) {
      rows.push({
        key: office ? rowKey(model, office.name) : model,
        model,
        salesOffice: office?.name || null,
        includeSalesOffice: Boolean(office),
      });
    }
  }
  return rows;
}

export function rowKey(model, salesOffice, articleCode = null) {
  const officeName = getOfficeName(salesOffice);
  if (articleCode) return `${model}::${articleCode}::${officeName}`;
  return officeName ? `${model}::${officeName}` : model;
}

/** @deprecated Use getOfficeLabel */
export function getOfficeShortLabel(office) {
  return getOfficeLabel(office);
}
