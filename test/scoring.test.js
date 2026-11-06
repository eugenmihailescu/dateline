import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultRanges, mergeState } from "../src/lib/migrate.js";
import { createIndex } from "../src/lib/normalize.js";
import { matchRange } from "../src/lib/ranges.js";
import { readSimpleRule } from "../src/lib/rule-form.js";
import { evaluateRules } from "../src/lib/rules.js";
import { buildSignal } from "../src/lib/signals.js";
import { validateRuleset } from "../src/lib/validate.js";

const sample = JSON.parse(readFileSync(new URL("../samples/example-ruleset.json", import.meta.url), "utf8"));
const index = createIndex();

function score(partial, rules = sample.rules, aggregation = "sum") {
  const signal = buildSignal(partial, index);
  const decision = evaluateRules(signal, rules, aggregation);
  const range = decision.status === "scored" ? matchRange(decision.score, defaultRanges()) : null;
  return { signal, decision, range };
}

test("sample rules score regions and leave unknowns unresolved", () => {
  const france = score({ handle: "a", accountBasedInRaw: "France" });
  assert.equal(france.decision.score, 20);
  assert.equal(france.range.id, "band-mid");

  const israel = score({ handle: "b", accountBasedInRaw: "Israel" });
  assert.equal(israel.signal.region, "middle_east");
  assert.equal(israel.decision.score, 50);
  assert.equal(israel.range.id, "band-high");

  const nigeria = score({ handle: "c", accountBasedInRaw: "Nigeria" });
  assert.equal(nigeria.decision.score, 10);
  assert.equal(nigeria.range.id, "band-low");

  const uk = score({ handle: "d", accountBasedInRaw: "United Kingdom" });
  assert.equal(uk.decision.status, "scored");
  assert.equal(uk.decision.score, 0);
  assert.equal(uk.range, null);

  const earth = score({ handle: "e", statedLocationRaw: "Earth" });
  assert.equal(earth.decision.status, "unresolved");
  assert.equal(earth.decision.score, null);
  assert.equal(earth.range, null);
});

test("a conflicting stated country lowers confidence below the default rules", () => {
  const mixed = score({
    handle: "f",
    accountBasedInRaw: "France",
    statedLocationRaw: "Lagos",
  });
  assert.equal(mixed.signal.conflict, true);
  assert.equal(mixed.signal.country, "FR");
  assert.equal(mixed.signal.confidence, 0.5);
  assert.equal(mixed.decision.score, 0);
});

test("first and max aggregation are configurable", () => {
  const rules = [
    { ...sample.rules[1], points: 20, priority: 10 },
    {
      id: "fr",
      name: "France",
      enabled: true,
      priority: 50,
      points: 5,
      when: {
        all: [
          { signal: "country", op: "in", values: ["FR"] },
          { signal: "confidence", op: "gte", value: 0.6 },
        ],
      },
    },
  ];
  const partial = { handle: "g", accountBasedInRaw: "France" };
  assert.equal(score(partial, rules, "sum").decision.score, 25);
  assert.equal(score(partial, rules, "max").decision.score, 20);
  assert.equal(score(partial, rules, "first").decision.matched[0].id, "fr");
  assert.equal(score(partial, rules, "first").decision.score, 5);
});

test("the sample ruleset validates and the simple form can read it", () => {
  const state = mergeState({ ...sample, ranges: defaultRanges() });
  assert.equal(validateRuleset(state).ok, true);
  assert.deepEqual(readSimpleRule(sample.rules[1].when).exceptCountries, ["GB", "IE"]);
});

test("overlapping bands are rejected until import allows them", () => {
  const state = mergeState({
    ranges: [
      { ...defaultRanges()[0], max: 30 },
      defaultRanges()[1],
    ],
  });
  assert.equal(validateRuleset(state).ok, false);
  assert.equal(validateRuleset(state, { allowOverlap: true }).ok, true);
});
