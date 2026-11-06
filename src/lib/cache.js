export const TTL = {
  aboutMs: 30 * 24 * 60 * 60 * 1000,
  statedMs: 7 * 24 * 60 * 60 * 1000,
  negativeMs: 24 * 60 * 60 * 1000,
  retryMs: 10 * 60 * 1000,
};

export function emptyCache() {
  return { entries: {} };
}

export function readCached(cache, handle, now) {
  const key = String(handle || "").toLowerCase();
  const entry = cache?.entries?.[key];
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    delete cache.entries[key];
    return null;
  }
  return entry;
}

export function putCached(cache, handle, entry, now, max = 5000) {
  const key = String(handle || "").toLowerCase();
  if (!key) return;
  cache.entries[key] = {
    ...entry,
    handle: entry.handle || handle,
    touchedAt: now,
  };
  const keys = Object.keys(cache.entries);
  if (keys.length <= max) return;
  keys.sort((a, b) => (cache.entries[a].touchedAt || 0) - (cache.entries[b].touchedAt || 0));
  for (const old of keys.slice(0, keys.length - max)) delete cache.entries[old];
}

export function expiryFor(partial, now) {
  if (partial?.accountBasedInRaw) return now + TTL.aboutMs;
  if (partial?.statedLocationRaw) return now + TTL.statedMs;
  if (partial?.aboutChecked) return now + TTL.negativeMs;
  return now + TTL.statedMs;
}
