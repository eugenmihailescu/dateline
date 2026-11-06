import { cleanText } from "./normalize.js";

export const SIGNALS = [
  "region",
  "country",
  "confidence",
  "countrySource",
  "lang",
  "websiteHost",
  "location",
  "conflict",
  "ambiguous",
];

export const AGGREGATIONS = ["sum", "max", "first"];

function valueOf(signal, name) {
  switch (name) {
    case "region":
      return signal.region;
    case "country":
      return signal.country;
    case "confidence":
      return signal.confidence;
    case "countrySource":
      return signal.countrySource;
    case "lang":
      return signal.lang;
    case "websiteHost":
      return signal.websiteHost;
    case "location":
      return signal.statedLocationRaw;
    case "conflict":
      return signal.conflict;
    case "ambiguous":
      return signal.ambiguous;
    default:
      return undefined;
  }
}

function hostIn(host, values) {
  if (!host) return false;
  return (values || []).some((item) => {
    const needle = String(item || "")
      .trim()
      .toLowerCase()
      .replace(/^\*\./, "")
      .replace(/^\./, "");
    if (!needle) return false;
    return host === needle || host.endsWith(`.${needle}`);
  });
}

export function matchesWhen(when, signal) {
  if (!when || typeof when !== "object") return false;
  if (Array.isArray(when.all)) return when.all.every((part) => matchesWhen(part, signal));
  if (Array.isArray(when.any)) return when.any.some((part) => matchesWhen(part, signal));
  if (when.not) return !matchesWhen(when.not, signal);
  return matchesCondition(when, signal);
}

function matchesCondition(condition, signal) {
  const value = valueOf(signal, condition.signal);
  if (value === undefined) return false;
  if (condition.signal === "websiteHost" && (condition.op === "in" || condition.op === "contains")) {
    return hostIn(value, condition.op === "contains" ? [condition.value] : condition.values);
  }
  switch (condition.op) {
    case "in":
      if (value == null) return false;
      return (condition.values || []).some(
        (item) => String(item).toLowerCase() === String(value).toLowerCase(),
      );
    case "gte":
      return typeof value === "number" && value >= condition.value;
    case "lte":
      return typeof value === "number" && value <= condition.value;
    case "eq":
      return value === condition.value;
    case "contains":
      if (value == null || condition.value == null) return false;
      return cleanText(value).includes(cleanText(condition.value));
    default:
      return false;
  }
}

export function evaluateRules(signal, rules, aggregation = "sum") {
  if (!signal?.resolved) return { status: "unresolved", score: null, matched: [] };
  const matched = (rules || []).filter((rule) => rule?.enabled && matchesWhen(rule.when, signal));
  if (aggregation === "first") {
    const winner = [...matched].sort((a, b) => b.priority - a.priority)[0];
    return winner
      ? { status: "scored", score: winner.points, matched: [winner] }
      : { status: "scored", score: 0, matched: [] };
  }
  if (aggregation === "max") {
    if (!matched.length) return { status: "scored", score: 0, matched: [] };
    const winner = [...matched].sort((a, b) => b.points - a.points || b.priority - a.priority)[0];
    return { status: "scored", score: winner.points, matched: [winner] };
  }
  const score = matched.reduce((sum, rule) => sum + Number(rule.points || 0), 0);
  return { status: "scored", score, matched };
}
