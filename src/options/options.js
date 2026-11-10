import { emptyCache } from "../lib/cache.js";
import { sanitizeCss } from "../lib/css-sanitize.js";
import { mergeState } from "../lib/migrate.js";
import { createIndex, exactRegionId, normalizeLocation, parseCountryList, regionFor } from "../lib/normalize.js";
import { compileSimpleRule, readSimpleRule } from "../lib/rule-form.js";
import { loadStateWithSync, saveState } from "../lib/storage.js";
import { validateRuleset } from "../lib/validate.js";

const $ = (id) => document.querySelector(id);
let state = await loadStateWithSync();
let editingId = "";
let jsonEdited = false;

const panels = {
  rules: $("#panel-rules"),
  appearance: $("#panel-appearance"),
  places: $("#panel-places"),
  settings: $("#panel-settings"),
};

for (const [name, button] of Object.entries({
  rules: $("#tab-rules"),
  appearance: $("#tab-appearance"),
  places: $("#tab-places"),
  settings: $("#tab-settings"),
})) {
  button.addEventListener("click", () => show(name));
}
show("rules");

function show(name) {
  for (const [key, panel] of Object.entries(panels)) {
    const selected = key === name;
    panel.hidden = !selected;
    $(`#tab-${key}`).setAttribute("aria-selected", selected ? "true" : "false");
  }
}

function index() {
  return createIndex({
    regionOverrides: state.regionOverrides,
    locationAliases: state.locationAliases,
  });
}

function say(message) {
  $("#status").textContent = message;
}

async function persist(next, message) {
  const result = await saveState(next);
  state = result.state;
  say(result.syncErrors.length ? result.syncErrors.join(" ") : message);
  render();
}

function render() {
  $("#enabled").checked = state.enabled;
  $("#aggregation").value = state.aggregation;
  $("#skip-promoted").checked = state.skipPromoted;
  $("#enrichment").checked = state.enrichment;
  $("#mark-unknown").checked = state.markUnknown;
  $("#debug").checked = state.debug;
  $("#sync-rules").checked = state.syncRules;
  $("#pace").value = state.paceMs;
  $("#pace-cap").value = state.maxPerMinute;
  $("#user-css").value = state.userCss;
  renderRules();
  renderRanges();
  renderAliases();
  renderCountries();
  renderPlayground();
}

function renderRules() {
  const list = $("#rule-list");
  list.replaceChildren();
  const rules = [...state.rules].sort((a, b) => b.priority - a.priority);
  if (!rules.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No rules yet. Add one below, or load the examples.";
    list.append(empty);
  }
  for (const rule of rules) {
    const item = document.createElement("article");
    item.className = "item";
    const main = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${rule.name} · ${rule.points} points`;
    const detail = document.createElement("p");
    detail.textContent = rule.enabled ? "Enabled" : "Off";
    main.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
      button(rule.enabled ? "Disable" : "Enable", () => toggleRule(rule.id)),
      button("Edit", () => editRule(rule)),
      button("Up", () => moveRule(rule.id, 1)),
      button("Down", () => moveRule(rule.id, -1)),
      button("Delete", () => removeRule(rule.id)),
    );
    item.append(main, actions);
    list.append(item);
  }
}

function renderRanges() {
  const list = $("#range-list");
  list.replaceChildren();
  const ranges = [...state.ranges].sort((a, b) => b.priority - a.priority);
  for (const range of ranges) {
    const item = document.createElement("article");
    item.className = "item";
    const main = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = range.name;
    const detail = document.createElement("p");
    const max = range.max == null ? "and up" : `to ${range.max}${range.maxInclusive ? " inclusive" : ""}`;
    detail.textContent = `${range.min ?? "any"} ${max}`;
    main.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(button("Up", () => moveRange(range.id, 1)), button("Delete", () => removeRange(range.id)));
    item.append(main, actions);
    list.append(item);
  }
}

function renderAliases() {
  const list = $("#alias-list");
  list.replaceChildren();
  for (const [phrase, code] of Object.entries(state.locationAliases)) {
    const item = document.createElement("article");
    item.className = "item";
    const text = document.createElement("strong");
    text.textContent = `${phrase} → ${code}`;
    item.append(text, button("Delete", () => removeAlias(phrase)));
    list.append(item);
  }
}

function renderCountries() {
  const table = $("#country-table");
  const query = $("#country-search").value.trim().toLowerCase();
  table.replaceChildren();
  const places = index();
  for (const country of places.countries) {
    const hay = `${country.name} ${country.code}`.toLowerCase();
    if (query && !hay.includes(query)) continue;
    const item = document.createElement("article");
    item.className = "item";
    const main = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${country.name} · ${country.code}`;
    main.append(title);
    const note = places.notes[country.code];
    if (note) {
      const detail = document.createElement("p");
      detail.textContent = note;
      main.append(detail);
    }
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Region for ${country.name}`);
    for (const region of places.regions) {
      const option = document.createElement("option");
      option.value = region.id;
      option.textContent = region.label;
      select.append(option);
    }
    select.value = regionFor(places, country.code);
    select.addEventListener("change", () => setRegion(country.code, select.value));
    item.append(main, select);
    table.append(item);
    if (table.childElementCount >= 40 && query.length < 2) break;
  }
}

function renderPlayground() {
  const text = $("#playground-text").value;
  const result = $("#playground-result");
  if (!text.trim()) {
    result.textContent = "Type a city or country to see the country and region.";
    return;
  }
  const places = index();
  const match = normalizeLocation(text, places);
  const regionId = exactRegionId(text, places);
  if (match.ambiguous) result.textContent = "Ambiguous. Dateline will not score it.";
  else if (!match.code && regionId) {
    const region = places.regions.find((item) => item.id === regionId);
    result.textContent = `${region?.label || regionId} · region label · confidence 0.90`;
  } else if (!match.code) result.textContent = `Unknown (${match.unknownReason}).`;
  else {
    const region = places.regions.find((item) => item.id === regionFor(places, match.code));
    result.textContent = `${match.code} · ${region?.label || "no region"} · ${match.source} · confidence ${match.confidence}`;
  }
}

function fillChoices() {
  const box = $("#region-choices");
  const list = $("#country-list");
  const places = createIndex();
  for (const region of places.regions) {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = region.id;
    input.name = "region";
    label.append(input, document.createTextNode(region.label));
    box.append(label);
  }
  for (const country of places.countries) {
    const option = document.createElement("option");
    option.value = `${country.name} (${country.code})`;
    list.append(option);
  }
}

function button(label, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function selectedRegions() {
  return [...document.querySelectorAll('#region-choices input:checked')].map((input) => input.value);
}

function setRegions(values) {
  for (const input of document.querySelectorAll("#region-choices input")) {
    input.checked = values.includes(input.value);
  }
}

function resetRuleForm() {
  editingId = "";
  $("#rule-form").reset();
  $("#rule-confidence").value = "0.6";
  $("#rule-points").value = "10";
  $("#rule-enabled").checked = true;
  $("#rule-json").value = "";
  jsonEdited = false;
  $("#rule-json").closest("details").open = false;
  $("#rule-form-title").textContent = "New rule";
  $("#rule-save").textContent = "Add rule";
  $("#rule-cancel").hidden = true;
  $("#rule-error").textContent = "";
  setRegions([]);
}

function editRule(rule) {
  editingId = rule.id;
  $("#rule-name").value = rule.name;
  $("#rule-points").value = String(rule.points);
  $("#rule-enabled").checked = rule.enabled;
  const simple = readSimpleRule(rule.when);
  jsonEdited = !simple;
  $("#rule-json").value = JSON.stringify(rule.when, null, 2);
  $("#rule-json").closest("details").open = !simple;
  setRegions(simple?.regions || []);
  $("#rule-countries").value = simple?.countries.join(", ") || "";
  $("#rule-except").value = simple?.exceptCountries.join(", ") || "";
  $("#rule-contains").value = simple?.locationContains || "";
  $("#rule-confidence").value = String(simple?.confidence ?? 0.6);
  $("#rule-form-title").textContent = "Edit rule";
  $("#rule-save").textContent = "Save rule";
  $("#rule-cancel").hidden = false;
  $("#rule-form").scrollIntoView({ block: "nearest" });
}

$("#rule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#rule-error");
  error.textContent = "";
  const places = index();
  const countries = parseCountryList($("#rule-countries").value, places);
  const except = parseCountryList($("#rule-except").value, places);
  if (!jsonEdited && (countries.errors.length || except.errors.length)) {
    error.textContent = `Unknown country: ${[...countries.errors, ...except.errors].join(", ")}`;
    return;
  }
  let when;
  if (jsonEdited) {
    when = safeParse($("#rule-json").value);
    if (!when) {
      error.textContent = "The JSON could not be read.";
      return;
    }
  } else {
    if (!selectedRegions().length && !countries.codes.length && !except.codes.length && !$("#rule-contains").value.trim()) {
      error.textContent = "Choose a region, a country, or a location phrase.";
      return;
    }
    when = compileSimpleRule({
      regions: selectedRegions(),
      countries: countries.codes,
      exceptCountries: except.codes,
      locationContains: $("#rule-contains").value.trim(),
      confidence: Number($("#rule-confidence").value),
    });
  }
  const current = state.rules.find((rule) => rule.id === editingId);
  const rule = {
    id: editingId || crypto.randomUUID(),
    name: $("#rule-name").value.trim(),
    enabled: $("#rule-enabled").checked,
    priority: current?.priority ?? nextPriority(state.rules),
    points: Number($("#rule-points").value),
    when,
  };
  const rules = editingId ? state.rules.map((item) => (item.id === editingId ? rule : item)) : [...state.rules, rule];
  const check = validateRuleset({ ...state, rules });
  if (!check.ok) {
    error.textContent = check.errors[0];
    return;
  }
  await persist({ ...state, rules }, editingId ? "Rule saved." : "Rule added.");
  resetRuleForm();
});

$("#rule-cancel").addEventListener("click", resetRuleForm);

$("#range-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#range-error");
  const classes = $("#range-classes").value.split(/[\s,]+/).filter(Boolean);
  const minRaw = $("#range-min").value;
  const maxRaw = $("#range-max").value;
  const actions = [];
  if (classes.length) actions.push({ type: "addClass", classes });
  if ($("#range-badge").checked) actions.push({ type: "badge" });
  const range = {
    id: crypto.randomUUID(),
    name: $("#range-name").value.trim(),
    min: minRaw === "" ? null : Number(minRaw),
    max: maxRaw === "" ? null : Number(maxRaw),
    minInclusive: $("#range-min-in").checked,
    maxInclusive: $("#range-max-in").checked,
    priority: nextPriority(state.ranges),
    actions,
  };
  const ranges = [...state.ranges, range];
  const check = validateRuleset({ ...state, ranges });
  if (!check.ok) {
    error.textContent = check.errors[0];
    return;
  }
  error.textContent = "";
  await persist({ ...state, ranges }, "Band added.");
  $("#range-form").reset();
  $("#range-min-in").checked = true;
  $("#range-badge").checked = true;
  syncPresetButtons();
});

function classTokens(value) {
  return new Set(value.split(/[\s,]+/).filter(Boolean));
}

function syncPresetButtons() {
  const classes = classTokens($("#range-classes").value);
  for (const preset of document.querySelectorAll("[data-class]")) {
    preset.setAttribute("aria-pressed", classes.has(preset.getAttribute("data-class")) ? "true" : "false");
  }
}

for (const preset of document.querySelectorAll("[data-class]")) {
  preset.addEventListener("click", () => {
    const input = $("#range-classes");
    const value = preset.getAttribute("data-class");
    const classes = classTokens(input.value);
    if (classes.has(value)) classes.delete(value);
    else classes.add(value);
    input.value = [...classes].join(" ");
    syncPresetButtons();
  });
}

$("#range-classes").addEventListener("input", syncPresetButtons);
syncPresetButtons();

$("#alias-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const places = index();
  const parsed = parseCountryList($("#alias-country").value, places);
  if (parsed.codes.length !== 1) {
    say("Choose one known country for the alias.");
    return;
  }
  const phrase = $("#alias-phrase").value.trim();
  await persist(
    { ...state, locationAliases: { ...state.locationAliases, [phrase]: parsed.codes[0] } },
    "Alias added.",
  );
  $("#alias-form").reset();
});

$("#playground-text").addEventListener("input", renderPlayground);
$("#country-search").addEventListener("input", renderCountries);

$("#aggregation").addEventListener("change", () => persist({ ...state, aggregation: $("#aggregation").value }, "Scoring updated."));
$("#enabled").addEventListener("change", () => persist({ ...state, enabled: $("#enabled").checked }, "Updated."));
$("#skip-promoted").addEventListener("change", () => persist({ ...state, skipPromoted: $("#skip-promoted").checked }, "Updated."));
$("#enrichment").addEventListener("change", () => persist({ ...state, enrichment: $("#enrichment").checked }, "Updated."));
$("#mark-unknown").addEventListener("change", () => persist({ ...state, markUnknown: $("#mark-unknown").checked }, "Updated."));
$("#debug").addEventListener("change", () => persist({ ...state, debug: $("#debug").checked }, "Updated."));
$("#sync-rules").addEventListener("change", () => persist({ ...state, syncRules: $("#sync-rules").checked }, "Updated."));
$("#pace").addEventListener("change", () => persist({ ...state, paceMs: Number($("#pace").value) }, "Updated."));
$("#pace-cap").addEventListener("change", () => persist({ ...state, maxPerMinute: Number($("#pace-cap").value) }, "Updated."));

$("#save-css").addEventListener("click", async () => {
  const clean = sanitizeCss($("#user-css").value);
  if (!clean.ok) {
    say(clean.error);
    return;
  }
  await persist({ ...state, userCss: clean.css }, "CSS saved.");
});

$("#clear-cache").addEventListener("click", async () => {
  if (!confirm("Clear saved account places on this browser?")) return;
  await chrome.storage.local.set({ profileCache: emptyCache() });
  say("Saved places cleared.");
});

$("#copy-debug").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "dateline:debug" });
    await navigator.clipboard.writeText(JSON.stringify(response?.entries || [], null, 2));
    say("Debug log copied.");
  } catch {
    say("Open an x.com tab with debug mode on, then copy again.");
  }
});

$("#export-rules").addEventListener("click", () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          schemaVersion: 1,
          aggregation: state.aggregation,
          rules: state.rules,
          ranges: state.ranges,
          regionOverrides: state.regionOverrides,
          locationAliases: state.locationAliases,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "dateline-rules.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

$("#import-rules").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async () => {
  const file = $("#import-file").files?.[0];
  $("#import-file").value = "";
  if (!file) return;
  try {
    const doc = JSON.parse(await file.text());
    await importDocument(doc, "Imported.");
  } catch (error) {
    say(error.message || "Import failed.");
  }
});

$("#load-examples").addEventListener("click", async () => {
  const response = await fetch(chrome.runtime.getURL("samples/example-ruleset.json"));
  const doc = await response.json();
  doc.rules = doc.rules.map((rule) => ({ ...rule, enabled: false, id: crypto.randomUUID() }));
  const names = new Set(state.rules.map((rule) => rule.name));
  doc.rules = doc.rules.filter((rule) => !names.has(rule.name));
  if (!doc.rules.length) {
    say("The examples are already in the list.");
    return;
  }
  await importDocument({ ...doc, rules: [...state.rules, ...doc.rules] }, "Examples added, turned off.");
});

async function importDocument(doc, message) {
  const next = mergeState({
    ...state,
    aggregation: doc.aggregation || state.aggregation,
    rules: Array.isArray(doc.rules) ? doc.rules : state.rules,
    ranges: Array.isArray(doc.ranges) ? doc.ranges : state.ranges,
    regionOverrides: doc.regionOverrides || state.regionOverrides,
    locationAliases: doc.locationAliases || state.locationAliases,
  });
  const check = validateRuleset(next, { allowOverlap: true });
  if (!check.ok) throw new Error(check.errors[0]);
  await persist(next, check.warnings.length ? `${message} ${check.warnings[0]}` : message);
}

async function toggleRule(id) {
  const rules = state.rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
  await persist({ ...state, rules }, "Rule updated.");
}

async function removeRule(id) {
  await persist({ ...state, rules: state.rules.filter((rule) => rule.id !== id) }, "Rule deleted.");
}

async function moveRule(id, direction) {
  await persist({ ...state, rules: move(state.rules, id, direction) }, "Order updated.");
}

async function removeRange(id) {
  const ranges = state.ranges.filter((range) => range.id !== id);
  const check = validateRuleset({ ...state, ranges });
  if (!check.ok) {
    say(check.errors[0]);
    return;
  }
  await persist({ ...state, ranges }, "Band deleted.");
}

async function moveRange(id, direction) {
  await persist({ ...state, ranges: move(state.ranges, id, direction) }, "Order updated.");
}

async function setRegion(code, region) {
  const overrides = { ...state.regionOverrides };
  const places = createIndex();
  if (places.regionByCountry[code] === region) delete overrides[code];
  else overrides[code] = region;
  const check = validateRuleset({ ...state, regionOverrides: overrides });
  if (!check.ok) {
    say(check.errors[0]);
    return;
  }
  await persist({ ...state, regionOverrides: overrides }, "Region updated.");
}

async function removeAlias(phrase) {
  const locationAliases = { ...state.locationAliases };
  delete locationAliases[phrase];
  await persist({ ...state, locationAliases }, "Alias deleted.");
}

function move(list, id, direction) {
  const ordered = [...list].sort((a, b) => b.priority - a.priority);
  const index = ordered.findIndex((item) => item.id === id);
  const swap = index - direction;
  if (index < 0 || swap < 0 || swap >= ordered.length) return list;
  const priorities = ordered.map((item) => item.priority);
  const next = ordered.slice();
  const [item] = next.splice(index, 1);
  next.splice(swap, 0, item);
  return next.map((entry, entryIndex) => ({ ...entry, priority: priorities[entryIndex] }));
}

function nextPriority(list) {
  return Math.max(0, ...list.map((item) => item.priority || 0)) + 10;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

$("#rule-json").addEventListener("input", () => {
  jsonEdited = true;
});

fillChoices();
render();
