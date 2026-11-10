import { applyVisual, clearMarks, lostDatelineClass, sameMarks, visualClassNames } from "../lib/apply.js";
import { emptyCache, expiryFor, putCached, readCached, TTL } from "../lib/cache.js";
import { sanitizeCss } from "../lib/css-sanitize.js";
import { defaultState, mergeState } from "../lib/migrate.js";
import { createIndex } from "../lib/normalize.js";
import { evaluateRules } from "../lib/rules.js";
import { matchRange } from "../lib/ranges.js";
import { buildSignal } from "../lib/signals.js";
import { loadStateWithSync } from "../lib/storage.js";
import { collectPosts, readProfile } from "./scanner.js";

const PAGE = "dateline-page";
const EXT = "dateline-ext";

let state = defaultState();
let cache = emptyCache();
let placesIndex = createIndex();
let signatures = new WeakMap();
let observer = null;
let classObserver = null;
const observed = new WeakSet();
const intersecting = new WeakSet();
const pending = new Map();
const queue = [];
const queued = new Set();
const debugRing = [];
let counts = { scored: 0, unresolved: 0 };
let pumping = false;
let lastFetch = 0;
let pauseUntil = 0;
let loggedOut = false;
let discoveryFailed = false;
let queryFailures = 0;
let minuteWindow = [];
let requestSeq = 0;
let acked = false;
let writingCache = false;
let cacheTimer = 0;
let scanTimer = 0;
let firstDirty = 0;

let started = false;

export function start() {
  if (started) return;
  started = true;
  // Register before boot() awaits storage. The popup treats a missing listener
  // as "this tab is not an x.com page".
  chrome.runtime.onMessage.addListener(onExtensionMessage);
  const begin = () => {
    boot().catch((error) => console.error("[dateline]", error));
  };
  if (document.body) begin();
  else document.addEventListener("DOMContentLoaded", begin, { once: true });
}

async function boot() {
  const stored = await chrome.storage.local.get("profileCache");
  state = await loadStateWithSync();
  cache = stored.profileCache?.entries ? stored.profileCache : emptyCache();
  rebuildIndex();
  applyChrome();
  chrome.storage.onChanged.addListener(onStorage);
  observer = new IntersectionObserver(onIntersect, { root: null, rootMargin: "400px 0px" });
  new MutationObserver(() => schedule()).observe(document.body, { childList: true, subtree: true });
  classObserver = new MutationObserver(onClassReset);
  window.addEventListener("message", onPageMessage);
  const helloTimer = setInterval(() => {
    if (acked) {
      clearInterval(helloTimer);
      return;
    }
    window.postMessage({ source: EXT, type: "hello" }, location.origin);
  }, 200);
  setTimeout(() => clearInterval(helloTimer), 3000);
  window.postMessage({ source: EXT, type: "hello" }, location.origin);
  schedule();
}

function rebuildIndex() {
  placesIndex = createIndex({
    regionOverrides: state.regionOverrides,
    locationAliases: state.locationAliases,
  });
  signatures = new WeakMap();
}

function onStorage(changes, area) {
  if (area !== "local") return;
  if (changes.state?.newValue) {
    state = mergeState(changes.state.newValue);
    rebuildIndex();
    applyChrome();
    if (!state.enrichment) {
      queue.length = 0;
      queued.clear();
    }
    schedule();
    pump();
  }
  if (changes.profileCache && !writingCache) {
    cache = changes.profileCache.newValue?.entries ? changes.profileCache.newValue : emptyCache();
    signatures = new WeakMap();
    schedule();
  }
}

function onExtensionMessage(message, _sender, sendResponse) {
  if (message?.type === "dateline:stats") {
    sendResponse({
      ...counts,
      pending: queue.length,
      loggedOut,
      discoveryFailed,
      enabled: state.enabled,
    });
    return;
  }
  if (message?.type === "dateline:debug") {
    sendResponse({ entries: debugRing });
  }
}

function onPageMessage(event) {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data.source !== PAGE) return;
  if (data.type === "hello-ack") {
    acked = true;
    return;
  }
  if (data.type === "navigate") {
    loggedOut = false;
    discoveryFailed = false;
    queryFailures = 0;
    schedule();
    return;
  }
  if (data.type === "passive") {
    for (const user of data.users || []) absorbRemote(user, Boolean(user.accountBasedIn));
    return;
  }
  if (data.type === "enrich-result") {
    const done = pending.get(data.requestId);
    if (!done) return;
    pending.delete(data.requestId);
    done(data);
  }
}

function applyChrome() {
  document.documentElement.classList.toggle("dl-debug-on", Boolean(state.debug && state.enabled));
  const style = document.getElementById("dl-user-css");
  const clean = state.enabled ? sanitizeCss(state.userCss) : { ok: false, css: "" };
  if (!state.enabled || !clean.ok || !clean.css.trim()) {
    style?.remove();
    return;
  }
  const node = style || document.createElement("style");
  node.id = "dl-user-css";
  node.textContent = clean.css;
  if (!style) document.documentElement.appendChild(node);
}

function onClassReset(records) {
  for (const record of records) {
    if (record.attributeName !== "class") continue;
    if (lostDatelineClass(record.oldValue, record.target)) {
      schedule(0);
      return;
    }
  }
}

function watchPostClasses(posts) {
  if (!classObserver) return;
  // Drop records from our own classList edits, then watch the posts we just painted.
  classObserver.disconnect();
  for (const post of posts) {
    classObserver.observe(post.element, {
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
  }
}

function schedule(delayOverride) {
  const now = Date.now();
  if (!firstDirty) firstDirty = now;
  clearTimeout(scanTimer);
  const delay = delayOverride === undefined ? (now - firstDirty >= 800 ? 0 : 200) : delayOverride;
  scanTimer = setTimeout(() => {
    firstDirty = 0;
    scan();
  }, delay);
}

function onIntersect(entries) {
  let changed = false;
  for (const entry of entries) {
    if (entry.isIntersecting) intersecting.add(entry.target);
    else intersecting.delete(entry.target);
    changed = true;
  }
  if (changed) schedule();
}

function scan() {
  const posts = collectPosts(document);
  const profile = readProfile(document);
  if (profile?.statedSeen) {
    const partial = partialFor(profile.handle);
    const previous = partial.statedLocationRaw;
    const previousHost = partial.websiteHost;
    partial.statedLocationRaw = profile.statedLocationRaw;
    if (profile.websiteHost) partial.websiteHost = profile.websiteHost;
    if (previous !== partial.statedLocationRaw || previousHost !== partial.websiteHost) {
      storePartial(profile.handle, partial);
    }
  }
  counts = { scored: 0, unresolved: 0 };
  const visible = new Set();
  for (const post of posts) {
    if (intersecting.has(post.element)) visible.add(post.handle.toLowerCase());
    if (observer && !observed.has(post.element)) {
      observed.add(post.element);
      observer.observe(post.element);
    }
    paint(post);
  }
  watchPostClasses(posts);
  if (profile) visible.add(profile.handle.toLowerCase());
  if (!state.enabled || !state.enrichment) return;
  for (const handle of visible) {
    const partial = partialFor(handle);
    if (needsEnrich(partial)) enqueue(handle);
  }
}

function paint(post) {
  const key = `${post.statusId}:${post.handle.toLowerCase()}`;
  if (!state.enabled || (state.skipPromoted && post.promoted)) {
    const signature = `${key}|off`;
    if (signatures.get(post.element) === signature && sameMarks(post.element, [])) return;
    signatures.set(post.element, signature);
    clearMarks(post.element);
    return;
  }
  const partial = partialFor(post.handle);
  const signal = buildSignal(partial, placesIndex);
  const decision = evaluateRules(signal, state.rules, state.aggregation);
  const range = decision.status === "scored" ? matchRange(decision.score, state.ranges) : null;
  if (decision.status === "scored") counts.scored += 1;
  else counts.unresolved += 1;
  const summary = [
    post.handle,
    signal.country || (signal.resolved ? signal.region : null) || signal.unknownReason || "unknown",
    signal.region || "",
    decision.status === "scored" ? decision.score : decision.status,
  ].join(" · ");
  const classes = visualClassNames({ decision, range, markUnknown: state.markUnknown });
  const signature = [key, decision.status, decision.score, range?.id || "", state.markUnknown, summary].join("|");
  if (signatures.get(post.element) === signature && sameMarks(post.element, classes)) return;
  signatures.set(post.element, signature);
  applyVisual(post.element, { key, decision, range, markUnknown: state.markUnknown, debug: state.debug, summary });
  if (state.debug) rememberDebug({ summary, selector: post.selector, signal, decision });
}

function partialFor(handle) {
  const entry = readCached(cache, handle, Date.now());
  return {
    handle,
    accountBasedInRaw: entry?.partial?.accountBasedInRaw || "",
    statedLocationRaw: entry?.partial?.statedLocationRaw || "",
    connectedViaRaw: entry?.partial?.connectedViaRaw || "",
    lang: entry?.partial?.lang || "",
    websiteHost: entry?.partial?.websiteHost || "",
    aboutChecked: entry?.partial?.aboutChecked === true,
    retryAt: entry?.partial?.retryAt || 0,
  };
}

function storePartial(handle, partial) {
  const now = Date.now();
  putCached(cache, handle, { partial, expiresAt: expiryFor(partial, now) }, now);
  scheduleCacheWrite();
}

function scheduleCacheWrite() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    writingCache = true;
    chrome.storage.local.set({ profileCache: cache }).finally(() => {
      writingCache = false;
    });
  }, 2000);
}

function absorbRemote(user, aboutChecked) {
  if (!user?.handle) return;
  const partial = partialFor(user.handle);
  if (user.accountBasedIn) partial.accountBasedInRaw = user.accountBasedIn;
  if (user.connectedVia) partial.connectedViaRaw = user.connectedVia;
  if (user.statedLocation) partial.statedLocationRaw = user.statedLocation;
  if (user.lang) partial.lang = user.lang;
  if (user.websiteHost) partial.websiteHost = user.websiteHost;
  if (aboutChecked) {
    partial.aboutChecked = true;
    partial.retryAt = 0;
  }
  storePartial(user.handle, partial);
  schedule();
}

function needsEnrich(partial) {
  if (!state.enrichment || loggedOut || discoveryFailed || partial.aboutChecked) return false;
  return !partial.retryAt || partial.retryAt <= Date.now();
}

function enqueue(handle) {
  const key = handle.toLowerCase();
  if (queued.has(key)) return;
  queued.add(key);
  queue.push(key);
  pump();
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length && state.enrichment && !loggedOut && !discoveryFailed) {
      const now = Date.now();
      if (now < pauseUntil) {
        setTimeout(pump, Math.min(pauseUntil - now, 60000));
        break;
      }
      minuteWindow = minuteWindow.filter((time) => now - time < 60000);
      if (minuteWindow.length >= state.maxPerMinute) {
        setTimeout(pump, 60000 - (now - minuteWindow[0]) + 25);
        break;
      }
      const wait = state.paceMs - (now - lastFetch);
      if (lastFetch && wait > 0) await sleep(wait);
      const handle = queue.shift();
      queued.delete(handle);
      if (!needsEnrich(partialFor(handle))) continue;
      lastFetch = Date.now();
      minuteWindow.push(lastFetch);
      const result = await requestEnrich(handle);
      applyEnrichResult(handle, result);
    }
  } finally {
    pumping = false;
  }
}

function requestEnrich(handle) {
  const requestId = `${Date.now()}-${requestSeq += 1}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ ok: false, reason: "http", handle });
    }, 15000);
    pending.set(requestId, (result) => {
      clearTimeout(timer);
      resolve({ ...result, handle });
    });
    window.postMessage({ source: EXT, type: "enrich", requestId, handle }, location.origin);
  });
}

function applyEnrichResult(handle, result) {
  if (result.ok) {
    queryFailures = 0;
    absorbRemote(
      {
        handle,
        accountBasedIn: result.accountBasedIn || "",
        statedLocation: result.statedLocation || "",
        connectedVia: result.connectedVia || "",
        lang: result.lang || "",
        websiteHost: result.websiteHost || "",
      },
      true,
    );
    return;
  }
  if (result.reason === "logged_out") {
    loggedOut = true;
    return;
  }
  if (result.reason === "rate_limit") {
    pauseUntil = result.reset ? result.reset * 1000 : Date.now() + 60000;
    if (!queued.has(handle)) {
      queued.add(handle);
      queue.unshift(handle);
    }
    return;
  }
  if (result.reason === "no_query" || result.reason === "bad_query") {
    queryFailures += 1;
    if (queryFailures >= 2) discoveryFailed = true;
    return;
  }
  const partial = partialFor(handle);
  partial.retryAt = Date.now() + TTL.retryMs;
  storePartial(handle, partial);
}

function rememberDebug(entry) {
  debugRing.push({ at: new Date().toISOString(), ...entry });
  if (debugRing.length > 50) debugRing.shift();
  console.info("[dateline]", entry.summary, entry.signal);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
