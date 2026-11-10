import { CLASS_NAME } from "./validate.js";

export function clearMarks(element) {
  for (const name of [...element.classList]) {
    if (name.startsWith("dl-")) element.classList.remove(name);
  }
  delete element.dataset.dlScore;
  delete element.dataset.dlLabel;
  delete element.dataset.dlBadge;
  delete element.dataset.dlKey;
  delete element.dataset.dlDebug;
}

export function visualClassNames({ decision, range, markUnknown }) {
  if (!decision || decision.status !== "scored" || !range) {
    return markUnknown && decision?.status === "unresolved" ? ["dl-unknown"] : [];
  }
  const classes = [];
  for (const action of range.actions || []) {
    if (action.type !== "addClass") continue;
    for (const name of action.classes || []) {
      if (CLASS_NAME.test(name)) classes.push(name);
    }
  }
  return classes;
}

// X rewrites className on the same article when a timestamp or counter updates.
// The score is unchanged, so a missing dl- class still has to be painted again.
export function sameMarks(element, classes) {
  const expected = new Set(classes);
  for (const name of element.classList) {
    if (!name.startsWith("dl-")) continue;
    if (!expected.delete(name)) return false;
  }
  return expected.size === 0;
}

export function lostDatelineClass(oldValue, element) {
  const previous = String(oldValue || "").split(/\s+/);
  return previous.some((name) => name.startsWith("dl-") && !element.classList.contains(name));
}

export function applyVisual(element, { key, decision, range, markUnknown, debug, summary }) {
  clearMarks(element);
  if (key) element.dataset.dlKey = key;
  if (debug && summary) element.dataset.dlDebug = summary;
  if (!decision || decision.status !== "scored") {
    if (markUnknown && decision?.status === "unresolved") element.classList.add("dl-unknown");
    return;
  }
  if (!range) return;
  let badge = false;
  for (const action of range.actions || []) {
    if (action.type === "badge") badge = true;
  }
  for (const name of visualClassNames({ decision, range, markUnknown })) element.classList.add(name);
  const labels = (decision.matched || []).map((rule) => rule.name).filter(Boolean);
  if (labels.length) element.dataset.dlLabel = labels.join(", ");
  if (badge) {
    element.dataset.dlBadge = "1";
    element.dataset.dlScore = String(decision.score);
  }
}
