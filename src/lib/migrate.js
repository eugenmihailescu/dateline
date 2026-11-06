export const SCHEMA_VERSION = 1;

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function defaultRanges() {
  return [
    {
      id: "band-low",
      name: "Low",
      min: 1,
      max: 20,
      minInclusive: true,
      maxInclusive: false,
      priority: 10,
      actions: [
        { type: "addClass", classes: ["dl-band-low"] },
        { type: "badge" },
      ],
    },
    {
      id: "band-mid",
      name: "Medium",
      min: 20,
      max: 50,
      minInclusive: true,
      maxInclusive: false,
      priority: 20,
      actions: [
        { type: "addClass", classes: ["dl-band-mid"] },
        { type: "badge" },
      ],
    },
    {
      id: "band-high",
      name: "High",
      min: 50,
      max: null,
      minInclusive: true,
      maxInclusive: false,
      priority: 30,
      actions: [
        { type: "addClass", classes: ["dl-band-high"] },
        { type: "badge" },
      ],
    },
  ];
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: 0,
    enabled: true,
    aggregation: "sum",
    debug: false,
    skipPromoted: true,
    enrichment: true,
    markUnknown: false,
    syncRules: false,
    paceMs: 800,
    maxPerMinute: 40,
    userCss: "",
    rules: [],
    ranges: defaultRanges(),
    regionOverrides: {},
    locationAliases: {},
  };
}

export function mergeState(state) {
  const base = defaultState();
  if (!state || typeof state !== "object") return base;
  return {
    ...base,
    ...state,
    schemaVersion: SCHEMA_VERSION,
    enabled: state.enabled !== false,
    aggregation: ["sum", "max", "first"].includes(state.aggregation) ? state.aggregation : "sum",
    debug: state.debug === true,
    skipPromoted: state.skipPromoted !== false,
    enrichment: state.enrichment !== false,
    markUnknown: state.markUnknown === true,
    syncRules: state.syncRules === true,
    paceMs: clamp(state.paceMs, 500, 10000, 800),
    maxPerMinute: clamp(state.maxPerMinute, 1, 40, 40),
    userCss: typeof state.userCss === "string" ? state.userCss : "",
    rules: Array.isArray(state.rules) ? state.rules : [],
    ranges: Array.isArray(state.ranges) ? state.ranges : base.ranges,
    regionOverrides:
      state.regionOverrides && typeof state.regionOverrides === "object" ? state.regionOverrides : {},
    locationAliases:
      state.locationAliases && typeof state.locationAliases === "object" ? state.locationAliases : {},
    updatedAt: Number(state.updatedAt) || 0,
  };
}
