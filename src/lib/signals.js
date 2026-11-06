import { normalizeLocation, regionFor } from "./normalize.js";

function hostOf(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function statedCode(result) {
  if (!result || result.ambiguous || !result.code) return null;
  return result.code;
}

export function buildSignal(partial, index) {
  const handle = String(partial?.handle || "").replace(/^@/, "").trim();
  const about = partial?.accountBasedInRaw
    ? normalizeLocation(partial.accountBasedInRaw, index)
    : null;
  const stated = partial?.statedLocationRaw
    ? normalizeLocation(partial.statedLocationRaw, index)
    : null;
  const aboutCode = statedCode(about);
  const statedResolved = statedCode(stated);

  let country = null;
  let countrySource = null;
  let confidence = 0;
  let conflict = false;
  let ambiguous = false;
  let unknownReason = "missing";
  let resolved = false;

  if (aboutCode) {
    country = aboutCode;
    countrySource = "about";
    confidence = 0.9;
    resolved = true;
    // A strong stated country that disagrees with X's label is not solid enough
    // for the default 0.60 rules. The country from X is still kept.
    if (statedResolved && statedResolved !== aboutCode && stated.confidence >= 0.6) {
      conflict = true;
      confidence = 0.5;
    }
  } else if (stated?.ambiguous) {
    ambiguous = true;
    unknownReason = "ambiguous";
  } else if (statedResolved) {
    country = statedResolved;
    countrySource = "stated";
    confidence = stated.confidence;
    resolved = true;
  } else if (stated?.unknownReason && stated.unknownReason !== "empty") {
    unknownReason = stated.unknownReason;
  }

  return {
    handle,
    accountBasedIn: aboutCode,
    statedLocationRaw: partial?.statedLocationRaw ? String(partial.statedLocationRaw).trim() : null,
    statedCountry: statedResolved,
    country,
    countrySource,
    region: country ? regionFor(index, country) : null,
    conflict,
    ambiguous,
    unknownReason: resolved ? null : unknownReason,
    confidence: resolved ? confidence : 0,
    lang: partial?.lang ? String(partial.lang).trim().toLowerCase() : null,
    websiteHost: hostOf(partial?.websiteHost),
    resolved,
  };
}
