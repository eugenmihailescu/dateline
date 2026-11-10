import assert from "node:assert/strict";
import test from "node:test";
import { places } from "../src/data/places.js";
import { createIndex, exactRegionId, normalizeConnectedVia, normalizeLocation, regionFor } from "../src/lib/normalize.js";

test("every country has one known region", () => {
  const regions = new Set(places.regions.map((region) => region.id));
  assert.equal(places.countries.length, 250);
  assert.equal(Object.keys(places.regionByCountry).length, 250);
  for (const country of places.countries) {
    assert.equal(places.regionByCountry[country.code] !== undefined, true, country.code);
    assert.equal(regions.has(places.regionByCountry[country.code]), true, country.code);
  }
  for (const [city, target] of Object.entries(places.cities)) {
    for (const code of Array.isArray(target) ? target : [target]) {
      assert.equal(places.regionByCountry[code] !== undefined, true, city);
    }
  }
});

test("disputed countries use the seeded region and can move", () => {
  const index = createIndex();
  assert.equal(regionFor(index, "IL"), "middle_east");
  assert.equal(regionFor(index, "EG"), "africa");
  assert.equal(regionFor(index, "TR"), "middle_east");
  assert.equal(regionFor(index, "CY"), "middle_east");
  assert.equal(regionFor(index, "RU"), "europe");
  assert.equal(regionFor(index, "MX"), "north_america");
  const moved = createIndex({ regionOverrides: { TR: "europe" } });
  assert.equal(regionFor(moved, "TR"), "europe");
});

test("free-text locations normalize or stay unknown", () => {
  const index = createIndex({ locationAliases: { holland: "NL" } });
  assert.equal(normalizeLocation("Lyon", index).code, "FR");
  assert.equal(normalizeLocation("Paris, France", index).code, "FR");
  assert.equal(normalizeLocation("Paris", index).ambiguous, true);
  assert.equal(normalizeLocation("Paris, Texas", index).code, "US");
  assert.equal(normalizeLocation("London / Lagos", index).ambiguous, true);
  assert.equal(normalizeLocation("based in Lyon", index).code, "FR");
  assert.equal(normalizeLocation("Earth", index).unknownReason, "non_geographic");
  assert.equal(normalizeLocation("United States", index).code, "US");
  assert.equal(normalizeLocation("Israel", index).code, "IL");
  assert.equal(normalizeLocation("Equatorial Guinea", index).code, "GQ");
  assert.equal(normalizeLocation("Guinea", index).code, "GN");
  assert.equal(normalizeLocation("Georgia, USA", index).code, "US");
  assert.equal(normalizeLocation("Holland", index).code, "NL");
  assert.equal(normalizeLocation("", index).unknownReason, "empty");
  assert.equal(normalizeLocation("no", index).code, null);
  assert.equal(normalizeLocation("Africa", index).code, null);
  assert.equal(exactRegionId("Africa", index), "africa");
  assert.equal(exactRegionId("South Africa", index), null);
  assert.equal(exactRegionId("Central America and Caribbean", index), "central_america_caribbean");
  assert.equal(exactRegionId("West Asia", index), "middle_east");
  assert.deepEqual(normalizeConnectedVia("West Asia App Store", index), { country: null, region: "middle_east" });
  assert.deepEqual(normalizeConnectedVia("South Africa Android App", index), { country: "ZA", region: "africa" });
  assert.deepEqual(normalizeConnectedVia("Africa Android App", index), { country: null, region: "africa" });
  assert.deepEqual(normalizeConnectedVia("United States App Store", index), { country: "US", region: "north_america" });
  assert.deepEqual(normalizeConnectedVia("South Asia App Store", index), { country: null, region: "south_asia" });
  assert.deepEqual(normalizeConnectedVia("Web", index), { country: null, region: null });
  assert.deepEqual(normalizeConnectedVia("European App Store", index), { country: null, region: null });
  assert.deepEqual(normalizeConnectedVia("France and Nigeria App Store", index), { country: null, region: null });
});
