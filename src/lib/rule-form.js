export function compileSimpleRule(input) {
  const all = [];
  if (input.regions?.length) all.push({ signal: "region", op: "in", values: [...input.regions] });
  if (input.countries?.length) all.push({ signal: "country", op: "in", values: [...input.countries] });
  if (input.exceptCountries?.length) {
    all.push({ not: { signal: "country", op: "in", values: [...input.exceptCountries] } });
  }
  if (input.locationContains) {
    all.push({ signal: "location", op: "contains", value: input.locationContains });
  }
  if (input.confidence != null && input.confidence !== "") {
    all.push({ signal: "confidence", op: "gte", value: Number(input.confidence) });
  }
  return { all };
}

export function readSimpleRule(when) {
  if (!when || !Array.isArray(when.all) || when.any || when.not) return null;
  const form = {
    regions: [],
    countries: [],
    exceptCountries: [],
    locationContains: "",
    confidence: 0.6,
  };
  for (const part of when.all) {
    if (part?.signal === "region" && part.op === "in" && Array.isArray(part.values)) {
      form.regions = [...part.values];
    } else if (part?.signal === "country" && part.op === "in" && Array.isArray(part.values)) {
      form.countries = [...part.values];
    } else if (part?.not?.signal === "country" && part.not.op === "in" && Array.isArray(part.not.values)) {
      form.exceptCountries = [...part.not.values];
    } else if (part?.signal === "location" && part.op === "contains" && typeof part.value === "string") {
      form.locationContains = part.value;
    } else if (part?.signal === "confidence" && part.op === "gte" && typeof part.value === "number") {
      form.confidence = part.value;
    } else {
      return null;
    }
  }
  return form;
}
