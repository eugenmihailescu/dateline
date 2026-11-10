import { places } from "../data/places.js";

export const REGION_IDS = places.regions.map((region) => region.id);

const DENY = new Set([
  "earth",
  "planet earth",
  "worldwide",
  "world",
  "the world",
  "moon",
  "hell",
  "heaven",
  "internet",
  "online",
  "web",
  "global",
  "everywhere",
  "somewhere",
  "nowhere",
  "here",
  "there",
  "home",
  "n a",
  "na",
  "secret",
  "classified",
  "confidential",
  "unknown",
  "prefer not to say",
  "your mom",
  "twitter",
  "metaverse",
  "remote",
  "undead",
  "universe",
  "milky way",
  "my house",
]);

const FILLERS = ["based in", "living in", "lives in", "located in", "i am in", "im in", "from"];

// Alpha-2 codes that are also ordinary English words. They stay valid in rules,
// and they do not match a location that is only that word.
const CODE_EXACT_SKIP = new Set(
  "am an as at ax be by do go id if in is it la me mr my no of on or re so to tv we".split(" "),
);

export function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripFiller(text) {
  for (const filler of FILLERS) {
    if (text === filler) return "";
    if (text.startsWith(`${filler} `)) return text.slice(filler.length + 1);
  }
  return text;
}

function addPhrase(list, phrase, code) {
  if (phrase.length >= 4) list.push({ phrase, code });
}

export function createIndex({ regionOverrides = {}, locationAliases = {} } = {}) {
  const exactCountry = new Map();
  const phraseCountry = [];
  const exactCity = new Map();
  const phraseCity = [];

  function addCountry(phrase, code) {
    const key = cleanText(phrase);
    if (!key) return;
    if (/^[a-z]{2}$/.test(key) && CODE_EXACT_SKIP.has(key)) return;
    if (!exactCountry.has(key)) exactCountry.set(key, new Set());
    exactCountry.get(key).add(code);
    addPhrase(phraseCountry, key, code);
  }

  for (const country of places.countries) {
    addCountry(country.name, country.code);
    if (!CODE_EXACT_SKIP.has(country.code.toLowerCase())) addCountry(country.code, country.code);
    for (const alias of country.aliases) addCountry(alias, country.code);
  }

  for (const [phrase, target] of Object.entries(places.cities)) {
    const key = cleanText(phrase);
    if (!key) continue;
    const codes = (Array.isArray(target) ? target : [target]).map((code) => code.toUpperCase());
    exactCity.set(key, codes);
    if (key.length >= 4) phraseCity.push({ phrase: key, codes });
  }

  phraseCountry.sort((a, b) => b.phrase.length - a.phrase.length);
  phraseCity.sort((a, b) => b.phrase.length - a.phrase.length);

  // Whole labels only. "South Africa" stays a country, and "european" is not Europe.
  // X's privacy label for the Middle East country set is "West Asia".
  const exactRegion = new Map();
  const phraseRegion = [];
  const regionLabels = [
    ...places.regions.map((region) => [region.label, region.id]),
    ["West Asia", "middle_east"],
  ];
  for (const [label, id] of regionLabels) {
    const key = cleanText(label);
    if (!key || exactRegion.has(key)) continue;
    exactRegion.set(key, id);
    phraseRegion.push({ phrase: key, id });
  }
  phraseRegion.sort((a, b) => b.phrase.length - a.phrase.length);

  const aliases = {};
  for (const [phrase, code] of Object.entries(locationAliases)) {
    const key = cleanText(phrase);
    const normalized = String(code || "").toUpperCase();
    if (key && places.regionByCountry[normalized]) aliases[key] = normalized;
  }

  return {
    countries: places.countries,
    regions: places.regions,
    notes: places.notes,
    regionByCountry: places.regionByCountry,
    exactCountry,
    phraseCountry,
    exactCity,
    phraseCity,
    exactRegion,
    phraseRegion,
    regionOverrides,
    locationAliases: aliases,
  };
}

function hit(code, confidence, source, raw) {
  return {
    code,
    confidence,
    source,
    ambiguous: false,
    unknownReason: null,
    raw,
  };
}

function unknown(reason, raw) {
  return {
    code: null,
    confidence: 0,
    source: null,
    ambiguous: false,
    unknownReason: reason,
    raw,
  };
}

function ambiguousResult(raw) {
  return {
    code: null,
    confidence: 0,
    source: null,
    ambiguous: true,
    unknownReason: "ambiguous",
    raw,
  };
}

function matchCountryPhrases(text, phrases) {
  let working = ` ${text} `;
  const found = [];
  for (const item of phrases) {
    const needle = ` ${item.phrase} `;
    if (!working.includes(needle)) continue;
    found.push(item.code);
    working = working.split(needle).join(" ");
  }
  return [...new Set(found)];
}

function matchRegionPhrases(text, phrases) {
  let working = ` ${text} `;
  const found = [];
  for (const item of phrases) {
    const needle = ` ${item.phrase} `;
    if (!working.includes(needle)) continue;
    found.push(item.id);
    working = working.split(needle).join(" ");
  }
  return [...new Set(found)];
}

function matchCityPhrases(text, phrases) {
  let working = ` ${text} `;
  const found = [];
  for (const item of phrases) {
    const needle = ` ${item.phrase} `;
    if (!working.includes(needle)) continue;
    found.push(...item.codes);
    working = working.split(needle).join(" ");
  }
  return [...new Set(found)];
}

export function normalizeLocation(raw, index) {
  const original = typeof raw === "string" ? raw.trim() : "";
  let text = stripFiller(cleanText(original));
  if (!text) return unknown(original ? "non_geographic" : "empty", original);
  if (DENY.has(text)) return unknown("non_geographic", original);

  const alias = index.locationAliases[text];
  if (alias) return hit(alias, 0.75, "alias", original);

  const exactCountries = index.exactCountry.get(text);
  if (exactCountries?.size === 1) return hit([...exactCountries][0], 0.75, "name", original);
  if (exactCountries?.size > 1) return ambiguousResult(original);

  const exactCity = index.exactCity.get(text);
  if (exactCity?.length === 1) return hit(exactCity[0], 0.6, "city", original);
  if (exactCity?.length > 1) return ambiguousResult(original);

  const countries = matchCountryPhrases(text, index.phraseCountry);
  if (countries.length === 1) return hit(countries[0], 0.75, "name", original);
  if (countries.length > 1) return ambiguousResult(original);

  const cities = matchCityPhrases(text, index.phraseCity);
  if (cities.length === 1) return hit(cities[0], 0.6, "city", original);
  if (cities.length > 1) return ambiguousResult(original);

  return unknown("unrecognized", original);
}

// X sometimes blurs "Account based in" to a region name such as "Africa".
export function exactRegionId(raw, index) {
  const text = stripFiller(cleanText(typeof raw === "string" ? raw.trim() : ""));
  if (!text || DENY.has(text)) return null;
  return index.exactRegion.get(text) || null;
}

// "Connected via" is a storefront string: "Africa Android App", "United States
// App Store", or "Web". A country phrase wins, so "South Africa" is not Africa-the-region.
export function normalizeConnectedVia(raw, index) {
  const text = cleanText(typeof raw === "string" ? raw.trim() : "");
  const empty = { country: null, region: null };
  if (!text || DENY.has(text)) return empty;
  const countries = matchCountryPhrases(text, index.phraseCountry);
  if (countries.length === 1) return { country: countries[0], region: regionFor(index, countries[0]) };
  if (countries.length > 1) return empty;
  const regions = matchRegionPhrases(text, index.phraseRegion);
  if (regions.length === 1) return { country: null, region: regions[0] };
  return empty;
}

export function regionFor(index, code) {
  if (!code) return null;
  const override = index.regionOverrides?.[code];
  if (override && REGION_IDS.includes(override)) return override;
  return index.regionByCountry[code] || null;
}

export function parseCountryList(text, index) {
  const parts = String(text || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const codes = [];
  const errors = [];
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (index.regionByCountry[upper]) {
      codes.push(upper);
      continue;
    }
    const match = normalizeLocation(part, index);
    if (match.code && match.source !== "city") codes.push(match.code);
    else errors.push(part);
  }
  return { codes: [...new Set(codes)], errors };
}
