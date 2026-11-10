import assert from "node:assert/strict";
import test from "node:test";
import { applyVisual, lostDatelineClass, sameMarks } from "../src/lib/apply.js";
import { emptyCache, expiryFor, putCached, readCached, TTL } from "../src/lib/cache.js";
import { sanitizeCss } from "../src/lib/css-sanitize.js";
import { handleFromHref, profileHandleFromPath, statusIdFromHref } from "../src/lib/dom.js";
import { extractSignals, findAboutSource, findAccountBasedIn } from "../src/lib/graphql.js";
import { mergeState } from "../src/lib/migrate.js";
import { rangesOverlap } from "../src/lib/ranges.js";
import { syncErrors, syncItems } from "../src/lib/sync.js";
function fakeArticle() {
  const classes = new Set();
  const dataset = {};
  return {
    dataset,
    classList: {
      add(...names) {
        for (const name of names) classes.add(name);
      },
      remove(...names) {
        for (const name of names) classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
      [Symbol.iterator]() {
        return classes[Symbol.iterator]();
      },
    },
  };
}

test("custom css cannot load a remote resource", () => {
  assert.equal(sanitizeCss("article.dl-band-high { opacity: 0.2; }").ok, true);
  assert.equal(sanitizeCss("body { background: url(https://example.com/a.png); }").ok, false);
  assert.equal(sanitizeCss("@import 'https://example.com/a.css';").ok, false);
});

test("cache expires and forgets the least recently stored accounts", () => {
  const cache = emptyCache();
  putCached(cache, "a", { partial: { handle: "a" }, expiresAt: 500 }, 100, 2);
  putCached(cache, "b", { partial: { handle: "b" }, expiresAt: 500 }, 200, 2);
  putCached(cache, "c", { partial: { handle: "c" }, expiresAt: 500 }, 300, 2);
  assert.equal(readCached(cache, "a", 300), null);
  assert.equal(readCached(cache, "b", 300)?.partial.handle, "b");
  assert.equal(readCached(cache, "b", 500), null);
});

test("recycled post nodes lose the previous color", () => {
  const element = fakeArticle();
  const high = {
    id: "band-high",
    actions: [{ type: "addClass", classes: ["dl-band-high"] }, { type: "badge" }],
  };
  applyVisual(element, {
    key: "1:ada",
    decision: { status: "scored", score: 50, matched: [{ name: "Israel" }] },
    range: high,
    markUnknown: false,
    debug: false,
    summary: "",
  });
  assert.equal(element.classList.contains("dl-band-high"), true);
  assert.equal(element.dataset.dlScore, "50");
  applyVisual(element, {
    key: "2:ada",
    decision: { status: "unresolved", score: null, matched: [] },
    range: null,
    markUnknown: false,
    debug: true,
    summary: "ada · missing",
  });
  assert.equal(element.classList.contains("dl-band-high"), false);
  assert.equal(element.dataset.dlScore, undefined);
  assert.equal(element.dataset.dlKey, "2:ada");
  assert.equal(element.dataset.dlDebug, "ada · missing");
});

test("a rewritten class attribute no longer counts as painted", () => {
  const element = fakeArticle();
  element.classList.add("dl-sweden");
  assert.equal(sameMarks(element, ["dl-sweden"]), true);
  element.classList.remove("dl-sweden");
  assert.equal(sameMarks(element, ["dl-sweden"]), false);
  element.classList.add("dl-sweden", "dl-africa");
  assert.equal(sameMarks(element, ["dl-sweden"]), false);
  element.classList.remove("dl-sweden", "dl-africa");
  assert.equal(sameMarks(element, []), true);
});

test("a class rewrite reports the lost dateline mark", () => {
  const element = fakeArticle();
  element.classList.add("dl-sweden");
  assert.equal(lostDatelineClass("css-1 dl-sweden", element), false);
  element.classList.remove("dl-sweden");
  assert.equal(lostDatelineClass("css-1 dl-sweden", element), true);
  assert.equal(lostDatelineClass("css-1", element), false);
});

test("post links yield the content author and the status id", () => {
  assert.equal(handleFromHref("https://x.com/ada"), "ada");
  assert.equal(handleFromHref("/home"), null);
  assert.equal(handleFromHref("/ada/status/99"), null);
  assert.equal(statusIdFromHref("/ada/status/99"), "99");
  assert.equal(profileHandleFromPath("/ada/with_replies"), "ada");
  assert.equal(profileHandleFromPath("/ada/status/99"), null);
});

test("graphql user objects keep the about label and the stated location", () => {
  const users = extractSignals({
    data: {
      user_result_by_screen_name: {
        result: {
          core: { screen_name: "ada" },
          about_profile: { account_based_in: "France", source: "United States App Store" },
          legacy: { location: "Lyon", lang: "en", screen_name: "ada" },
        },
      },
    },
  });
  assert.equal(users.length, 1);
  assert.equal(users[0].handle, "ada");
  assert.equal(users[0].accountBasedIn, "France");
  assert.equal(users[0].statedLocation, "Lyon");
  assert.equal(users[0].connectedVia, "United States App Store");
  assert.equal(findAccountBasedIn({ about_profile: { account_based_in: "Israel" } }), "Israel");
  const africa = extractSignals({
    data: {
      user: {
        result: {
          core: { screen_name: "Ugboma4Christ" },
          about_profile: { accountBasedIn: "Africa", source: "Africa Android App" },
        },
      },
    },
  });
  assert.equal(africa[0].accountBasedIn, "Africa");
  assert.equal(africa[0].connectedVia, "Africa Android App");
  assert.equal(findAboutSource({ about_profile: { source: "Iran Android App" } }), "Iran Android App");
});

test("an About label keeps the longer cache lifetime", () => {
  const now = 1_000_000;
  assert.equal(expiryFor({ accountBasedInRaw: "Africa" }, now), now + TTL.aboutMs);
  assert.equal(expiryFor({ connectedViaRaw: "Africa Android App" }, now), now + TTL.aboutMs);
  assert.equal(expiryFor({ statedLocationRaw: "Germany" }, now), now + TTL.statedMs);
  assert.equal(expiryFor({ aboutChecked: true }, now), now + TTL.negativeMs);
});

test("adjacent score bands do not overlap", () => {
  assert.equal(
    rangesOverlap(
      { min: 1, max: 20, minInclusive: true, maxInclusive: false },
      { min: 20, max: 50, minInclusive: true, maxInclusive: false },
    ),
    false,
  );
  assert.equal(
    rangesOverlap(
      { min: 1, max: 20, minInclusive: true, maxInclusive: true },
      { min: 20, max: 50, minInclusive: true, maxInclusive: false },
    ),
    true,
  );
});

test("sync rejects a rules item over the per-item cap", () => {
  const state = mergeState({ rules: [{ id: "x", name: "x".repeat(9000), enabled: true, priority: 1, points: 1, when: { all: [] } }] });
  const errors = syncErrors(syncItems(state));
  assert.equal(errors.some((error) => error.includes("dlRules")), true);
});

test("pace settings are clamped into the safe range", () => {
  const state = mergeState({ paceMs: 1, maxPerMinute: 500 });
  assert.equal(state.paceMs, 500);
  assert.equal(state.maxPerMinute, 40);
});
