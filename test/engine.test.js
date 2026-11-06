import assert from "node:assert/strict";
import test from "node:test";
import { applyVisual } from "../src/lib/apply.js";
import { emptyCache, putCached, readCached } from "../src/lib/cache.js";
import { sanitizeCss } from "../src/lib/css-sanitize.js";
import { handleFromHref, profileHandleFromPath, statusIdFromHref } from "../src/lib/dom.js";
import { extractSignals, findAccountBasedIn } from "../src/lib/graphql.js";
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
          about_profile: { account_based_in: "France" },
          legacy: { location: "Lyon", lang: "en", screen_name: "ada" },
        },
      },
    },
  });
  assert.equal(users.length, 1);
  assert.equal(users[0].handle, "ada");
  assert.equal(users[0].accountBasedIn, "France");
  assert.equal(users[0].statedLocation, "Lyon");
  assert.equal(findAccountBasedIn({ about_profile: { account_based_in: "Israel" } }), "Israel");
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
