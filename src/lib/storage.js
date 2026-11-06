import { mergeState } from "./migrate.js";
import { stateFromSync, syncErrors, syncItems } from "./sync.js";

export async function loadState(area = chrome.storage.local) {
  const data = await area.get("state");
  return mergeState(data.state);
}

export async function saveState(state, area = chrome.storage.local) {
  const next = { ...mergeState(state), updatedAt: Date.now() };
  if (next.syncRules) {
    const items = syncItems(next);
    const errors = syncErrors(items);
    if (errors.length) {
      next.syncRules = false;
      await area.set({ state: next });
      return { state: next, syncErrors: errors };
    }
    try {
      await chrome.storage.sync.set(items);
    } catch (error) {
      next.syncRules = false;
      await area.set({ state: next });
      return { state: next, syncErrors: [error?.message || "Chrome could not sync these rules."] };
    }
  }
  await area.set({ state: next });
  return { state: next, syncErrors: [] };
}

export async function loadStateWithSync() {
  let state = await loadState();
  if (!state.syncRules) return state;
  const items = await chrome.storage.sync.get(["dlMeta", "dlRules", "dlRanges", "dlPlaces", "dlCss"]);
  const pulled = mergeState(stateFromSync(items, state));
  if (pulled.updatedAt !== state.updatedAt) {
    await chrome.storage.local.set({ state: pulled });
    return pulled;
  }
  return state;
}
