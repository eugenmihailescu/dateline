import { loadStateWithSync } from "../lib/storage.js";
import { defaultState } from "../lib/migrate.js";
import { emptyCache } from "../lib/cache.js";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["state", "profileCache"]);
  if (!stored.state) {
    await chrome.storage.local.set({ state: defaultState(), profileCache: emptyCache() });
  }
  if (!stored.profileCache) await chrome.storage.local.set({ profileCache: emptyCache() });
  await loadStateWithSync();
});

chrome.runtime.onStartup.addListener(() => {
  loadStateWithSync().catch(() => {});
});
