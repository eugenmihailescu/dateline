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

test("About region labels and Connected via count as that region", () => {
  const africa = {
    id: "africa",
    name: "Africa",
    enabled: true,
    priority: 10,
    points: 20,
    when: {
      all: [
        { signal: "region", op: "in", values: ["africa"] },
        { signal: "confidence", op: "gte", value: 0.6 },
      ],
    },
  };
  const germany = {
    id: "de",
    name: "Germany",
    enabled: true,
    priority: 20,
    points: 11,
    when: {
      all: [
        { signal: "region", op: "in", values: ["europe"] },
        { signal: "country", op: "in", values: ["DE"] },
        { signal: "confidence", op: "gte", value: 0.6 },
      ],
    },
  };
  const rules = [africa, germany];
  const based = score(
    {
      handle: "Ugboma4Christ",
      accountBasedInRaw: "Africa",
      statedLocationRaw: "Frankfurt Wurstchen, Germany",
      connectedViaRaw: "Africa Android App",
    },
    rules,
  );
  assert.equal(based.signal.region, "africa");
  assert.equal(based.signal.country, null);
  assert.equal(based.signal.countrySource, "about");
  assert.equal(based.signal.confidence, 0.9);
  assert.equal(based.signal.conflict, true);
  assert.equal(based.signal.resolved, true);
  assert.equal(based.decision.score, 20);
  assert.deepEqual(
    based.decision.matched.map((rule) => rule.id),
    ["africa"],
  );

  const via = score(
    {
      handle: "Ugboma4Christ",
      statedLocationRaw: "Frankfurt Wurstchen, Germany",
      connectedViaRaw: "Africa Android App",
    },
    rules,
  );
  assert.equal(via.signal.region, "africa");
  assert.equal(via.signal.country, null);
  assert.equal(via.signal.countrySource, "connected");
  assert.equal(via.signal.confidence, 0.7);
  assert.equal(via.signal.conflict, true);
  assert.equal(via.decision.score, 20);

  const sameRegion = score({ handle: "ng", accountBasedInRaw: "Africa", statedLocationRaw: "Lagos" }, rules);
  assert.equal(sameRegion.signal.country, "NG");
  assert.equal(sameRegion.signal.region, "africa");
  assert.equal(sameRegion.signal.conflict, false);
  assert.equal(sameRegion.signal.confidence, 0.9);

  const countryWins = score(
    {
      handle: "fr",
      accountBasedInRaw: "France",
      connectedViaRaw: "Africa Android App",
      statedLocationRaw: "Germany",
    },
    rules,
  );
  assert.equal(countryWins.signal.country, "FR");
  assert.equal(countryWins.signal.region, "europe");
  assert.equal(countryWins.signal.confidence, 0.5);
  assert.equal(countryWins.decision.score, 0);

  const web = score({ handle: "web", connectedViaRaw: "Web", statedLocationRaw: "Germany" }, rules);
  assert.equal(web.signal.country, "DE");
  assert.equal(web.signal.countrySource, "stated");
  assert.equal(web.decision.score, 11);

  const bare = score({ handle: "bare", statedLocationRaw: "Africa" }, rules);
  assert.equal(bare.decision.status, "unresolved");
});

test("X's West Asia label is the Middle East country set", () => {
  const rule = {
    id: "west-asia",
    name: "West Asia",
    enabled: true,
    priority: 15,
    points: 15,
    when: {
      all: [
        { signal: "region", op: "in", values: ["middle_east"] },
        { signal: "confidence", op: "gte", value: 0.6 },
      ],
    },
  };
  const account = score({
    handle: "TheBestqueenx",
    accountBasedInRaw: "West Asia",
    connectedViaRaw: "West Asia App Store",
  }, [rule]);
  assert.equal(account.signal.region, "middle_east");
  assert.equal(account.signal.country, null);
  assert.equal(account.signal.countrySource, "about");
  assert.equal(account.signal.confidence, 0.9);
  assert.equal(account.signal.resolved, true);
  assert.equal(account.decision.score, 15);

  const turkey = score({ handle: "tr", accountBasedInRaw: "Turkey" }, [rule]);
  assert.equal(turkey.signal.country, "TR");
  assert.equal(turkey.signal.region, "middle_east");
  assert.equal(turkey.decision.score, 15);

  const sweden = score({ handle: "se", accountBasedInRaw: "Sweden" }, [rule]);
  assert.equal(sweden.decision.score, 0);
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
