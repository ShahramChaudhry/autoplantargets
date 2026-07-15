import { divisions } from "./divisions";
import { salesGroups } from "./salesGroups";
import { salesOffices } from "./salesOffices";
import { salesExecutives } from "./salesExecutives";
import { models } from "./models";
import { divisionGridConfig } from "./gridConfig";

/**
 * Master-data accessors.
 * Swap implementations here later for Databricks / API calls —
 * React components should keep calling these helpers only.
 */

export function getDivisions() {
  return divisions;
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

export function getSalesGroupByCode(code) {
  return salesGroups.find((g) => g.code === code) || null;
}

export function getSalesGroupByName(name) {
  return salesGroups.find((g) => g.name === name) || null;
}

export function getSalesOffices(division) {
  const name = typeof division === "string" ? division : division?.name;
  return salesOffices[name] || [];
}

export function getSalesExecutives(division, salesOffice) {
  const divisionName = typeof division === "string" ? division : division?.name;
  if (!divisionName || !salesOffice) return [];
  return salesExecutives[divisionName]?.[salesOffice] || [];
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
 */
export function buildTargetGridRows(division, salesGroup, salesOffice = null) {
  const divisionName = typeof division === "string" ? division : division?.name;
  const groupName = typeof salesGroup === "string" ? salesGroup : salesGroup?.name;
  const config = getGridConfig(divisionName);
  const modelList = getModels(divisionName, groupName);

  let offices;
  if (salesOffice) {
    offices = [salesOffice];
  } else if (config.includeSalesOffices) {
    offices = getSalesOffices(divisionName);
  } else {
    offices = [null];
  }

  const rows = [];
  for (const model of modelList) {
    for (const office of offices) {
      rows.push({
        key: office ? `${model}::${office}` : model,
        model,
        salesOffice: office,
        includeSalesOffice: Boolean(office),
      });
    }
  }
  return rows;
}

export function rowKey(model, salesOffice) {
  return salesOffice ? `${model}::${salesOffice}` : model;
}
