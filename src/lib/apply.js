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

export function applyVisual(element, { key, decision, range, markUnknown, debug, summary }) {
  clearMarks(element);
  if (key) element.dataset.dlKey = key;
  if (debug && summary) element.dataset.dlDebug = summary;
  if (!decision || decision.status !== "scored") {
    if (markUnknown && decision?.status === "unresolved") element.classList.add("dl-unknown");
    return;
  }
  if (!range) return;
  const classes = [];
  let badge = false;
  for (const action of range.actions || []) {
    if (action.type === "addClass") {
      for (const name of action.classes || []) {
        if (CLASS_NAME.test(name)) classes.push(name);
      }
    } else if (action.type === "badge") {
      badge = true;
    }
  }
  for (const name of classes) element.classList.add(name);
  const labels = (decision.matched || []).map((rule) => rule.name).filter(Boolean);
  if (labels.length) element.dataset.dlLabel = labels.join(", ");
  if (badge) {
    element.dataset.dlBadge = "1";
    element.dataset.dlScore = String(decision.score);
  }
}
