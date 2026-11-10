import { exactRegionId, normalizeConnectedVia, normalizeLocation, regionFor } from "./normalize.js";

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

function statedAgrees(index, statedResolved, stated, regionId) {
  if (!statedResolved || !stated || stated.confidence < 0.6) return { country: null, conflict: false };
  if (regionFor(index, statedResolved) === regionId) return { country: statedResolved, conflict: false };
  return { country: null, conflict: true };
}

export function buildSignal(partial, index) {
  const handle = String(partial?.handle || "").replace(/^@/, "").trim();
  const about = partial?.accountBasedInRaw
    ? normalizeLocation(partial.accountBasedInRaw, index)
    : null;
  const aboutRegion = partial?.accountBasedInRaw ? exactRegionId(partial.accountBasedInRaw, index) : null;
  const stated = partial?.statedLocationRaw
    ? normalizeLocation(partial.statedLocationRaw, index)
    : null;
  const connected = partial?.connectedViaRaw ? normalizeConnectedVia(partial.connectedViaRaw, index) : null;
  const aboutCode = statedCode(about);
  const statedResolved = statedCode(stated);

  let country = null;
  let region = null;
  let countrySource = null;
  let confidence = 0;
  let conflict = false;
  let ambiguous = false;
  let unknownReason = "missing";
  let resolved = false;

  if (aboutCode) {
    country = aboutCode;
    region = regionFor(index, aboutCode);
    countrySource = "about";
    confidence = 0.9;
    resolved = true;
    // A strong stated country that disagrees with X's country is not solid enough
    // for the default 0.60 rules. The country from X is still kept.
    if (statedResolved && statedResolved !== aboutCode && stated.confidence >= 0.6) {
      conflict = true;
      confidence = 0.5;
    }
  } else if (aboutRegion) {
    // A blurred region such as "Africa" stays at 0.90 even when the profile
    // names a country in another region. That country is not scored.
    countrySource = "about";
    confidence = 0.9;
    resolved = true;
    region = aboutRegion;
    const agreed = statedAgrees(index, statedResolved, stated, aboutRegion);
    country = agreed.country;
    conflict = agreed.conflict;
  } else if (connected?.country) {
    country = connected.country;
    region = connected.region;
    countrySource = "connected";
    confidence = 0.7;
    resolved = true;
    if (statedResolved && statedResolved !== connected.country && stated.confidence >= 0.6) conflict = true;
  } else if (connected?.region) {
    countrySource = "connected";
    confidence = 0.7;
    resolved = true;
    region = connected.region;
    const agreed = statedAgrees(index, statedResolved, stated, connected.region);
    country = agreed.country;
    conflict = agreed.conflict;
  } else if (stated?.ambiguous) {
    ambiguous = true;
    unknownReason = "ambiguous";
  } else if (statedResolved) {
    country = statedResolved;
    region = regionFor(index, country);
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
    region,
    conflict,
    ambiguous,
    unknownReason: resolved ? null : unknownReason,
    confidence: resolved ? confidence : 0,
    lang: partial?.lang ? String(partial.lang).trim().toLowerCase() : null,
    websiteHost: hostOf(partial?.websiteHost),
    resolved,
  };
}
