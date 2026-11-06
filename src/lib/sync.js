export const SYNC_ITEM_LIMIT = 8000;
export const SYNC_TOTAL_LIMIT = 100000;

export function syncItems(state) {
  return {
    dlMeta: {
      updatedAt: state.updatedAt || 0,
      schemaVersion: state.schemaVersion,
      aggregation: state.aggregation,
      enabled: state.enabled,
      debug: state.debug,
      skipPromoted: state.skipPromoted,
      enrichment: state.enrichment,
      markUnknown: state.markUnknown,
      syncRules: state.syncRules,
      paceMs: state.paceMs,
      maxPerMinute: state.maxPerMinute,
    },
    dlRules: state.rules || [],
    dlRanges: state.ranges || [],
    dlPlaces: {
      regionOverrides: state.regionOverrides || {},
      locationAliases: state.locationAliases || {},
    },
    dlCss: state.userCss || "",
  };
}

export function syncErrors(items) {
  const errors = [];
  let total = 0;
  for (const [key, value] of Object.entries(items)) {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
    total += bytes;
    if (bytes > SYNC_ITEM_LIMIT) {
      errors.push(`${key} is ${bytes} bytes. Sync allows ${SYNC_ITEM_LIMIT} bytes per item.`);
    }
  }
  if (total > SYNC_TOTAL_LIMIT) {
    errors.push(`Sync payload is ${total} bytes. The limit is ${SYNC_TOTAL_LIMIT}.`);
  }
  return errors;
}

export function stateFromSync(items, fallback) {
  if (!items?.dlMeta?.updatedAt) return fallback;
  if ((items.dlMeta.updatedAt || 0) <= (fallback.updatedAt || 0)) return fallback;
  return {
    ...fallback,
    ...items.dlMeta,
    rules: Array.isArray(items.dlRules) ? items.dlRules : fallback.rules,
    ranges: Array.isArray(items.dlRanges) ? items.dlRanges : fallback.ranges,
    regionOverrides: items.dlPlaces?.regionOverrides || {},
    locationAliases: items.dlPlaces?.locationAliases || {},
    userCss: typeof items.dlCss === "string" ? items.dlCss : fallback.userCss,
  };
}
