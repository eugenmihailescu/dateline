import { REGION_IDS } from "./normalize.js";
import { AGGREGATIONS, SIGNALS } from "./rules.js";
import { rangesOverlap } from "./ranges.js";
import { places } from "../data/places.js";

export const CLASS_NAME = /^dl-[a-z0-9-]{1,32}$/;
const OPS = new Set(["in", "gte", "lte", "eq", "contains"]);

function validateWhen(when, errors, path) {
  if (!when || typeof when !== "object" || Array.isArray(when)) {
    errors.push(`${path} must be a condition or a group.`);
    return;
  }
  const groups = ["all", "any", "not"].filter((key) => key in when);
  if (groups.length > 1) {
    errors.push(`${path} can use only one of all, any, or not.`);
    return;
  }
  if (when.all || when.any) {
    const key = when.all ? "all" : "any";
    const list = when[key];
    if (!Array.isArray(list) || list.length === 0) {
      errors.push(`${path}.${key} must be a non-empty list.`);
      return;
    }
    list.forEach((part, index) => validateWhen(part, errors, `${path}.${key}[${index}]`));
    return;
  }
  if (when.not) {
    validateWhen(when.not, errors, `${path}.not`);
    return;
  }
  if (!SIGNALS.includes(when.signal)) errors.push(`${path} uses an unknown signal.`);
  if (!OPS.has(when.op)) errors.push(`${path} uses an unknown operator.`);
  if (when.op === "in" && !Array.isArray(when.values)) errors.push(`${path}.values must be a list.`);
  if ((when.op === "gte" || when.op === "lte") && typeof when.value !== "number") {
    errors.push(`${path}.value must be a number.`);
  }
  if (when.op === "contains" && typeof when.value !== "string") {
    errors.push(`${path}.value must be text.`);
  }
  if (when.signal === "region" && when.op === "in") {
    for (const value of when.values || []) {
      if (!REGION_IDS.includes(value)) errors.push(`${path} has an unknown region ${value}.`);
    }
  }
  if (when.signal === "country" && when.op === "in") {
    for (const value of when.values || []) {
      if (!places.regionByCountry[value]) errors.push(`${path} has an unknown country ${value}.`);
    }
  }
}

function validateBound(value, path, errors) {
  if (value == null) return;
  if (typeof value !== "number" || Number.isNaN(value)) errors.push(`${path} must be a number or empty.`);
}

export function validateRuleset(doc, { allowOverlap = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!doc || typeof doc !== "object") return { ok: false, errors: ["Ruleset must be an object."], warnings };
  if (!AGGREGATIONS.includes(doc.aggregation)) errors.push("Aggregation must be sum, max, or first.");
  if (!Array.isArray(doc.rules)) errors.push("Rules must be a list.");
  for (const [index, rule] of (doc.rules || []).entries()) {
    const path = `rules[${index}]`;
    if (!rule?.id) errors.push(`${path} needs an id.`);
    if (!rule?.name || typeof rule.name !== "string") errors.push(`${path} needs a name.`);
    if (typeof rule?.enabled !== "boolean") errors.push(`${path}.enabled must be true or false.`);
    if (typeof rule?.priority !== "number") errors.push(`${path}.priority must be a number.`);
    if (typeof rule?.points !== "number" || Number.isNaN(rule.points)) errors.push(`${path}.points must be a number.`);
    validateWhen(rule?.when, errors, `${path}.when`);
  }
  if (!Array.isArray(doc.ranges)) errors.push("Ranges must be a list.");
  for (const [index, range] of (doc.ranges || []).entries()) {
    const path = `ranges[${index}]`;
    if (!range?.id) errors.push(`${path} needs an id.`);
    if (!range?.name) errors.push(`${path} needs a name.`);
    if (typeof range?.priority !== "number") errors.push(`${path}.priority must be a number.`);
    validateBound(range?.min, `${path}.min`, errors);
    validateBound(range?.max, `${path}.max`, errors);
    if (typeof range?.min === "number" && typeof range?.max === "number") {
      if (range.min > range.max) errors.push(`${range.name || path} has a minimum above its maximum.`);
      if (range.min === range.max && !(range.minInclusive !== false && range.maxInclusive === true)) {
        errors.push(`${range.name || path} does not include any score.`);
      }
    }
    for (const action of range.actions || []) {
      if (action.type === "addClass") {
        for (const name of action.classes || []) {
          if (!CLASS_NAME.test(name)) errors.push(`${path} has a class that must look like dl-highlight.`);
        }
      } else if (action.type !== "badge") {
        errors.push(`${path} has an unknown action ${action.type}.`);
      }
    }
  }
  const ranges = doc.ranges || [];
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      if (!rangesOverlap(ranges[i], ranges[j])) continue;
      const message = `${ranges[i].name} overlaps ${ranges[j].name}.`;
      if (allowOverlap) warnings.push(message);
      else errors.push(message);
    }
  }
  for (const [code, region] of Object.entries(doc.regionOverrides || {})) {
    if (!places.regionByCountry[code]) errors.push(`Unknown country override ${code}.`);
    if (!REGION_IDS.includes(region)) errors.push(`Unknown region override ${region}.`);
  }
  for (const [phrase, code] of Object.entries(doc.locationAliases || {})) {
    if (!String(phrase).trim()) errors.push("A location alias is empty.");
    if (!places.regionByCountry[String(code || "").toUpperCase()]) {
      errors.push(`Alias “${phrase}” uses an unknown country.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
