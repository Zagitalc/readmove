import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { publishedSalesSchema } from "../../shared/published-sales";
import { saleLocationsSchema } from "../../shared/sale-locations";
import { inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
import { locateSales } from "../../src/property/located-sales";
import { findComparableSales } from "../../src/property/comparables";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const data = publishedSalesSchema.parse(read("public/data/sales-2025.v1.json"));
const locations = saleLocationsSchema.parse(
  read("public/data/sale-locations.v2.json"),
);
it("retains all 100 official coordinates and renders only the 65 in map bounds", () => {
  expect(locations.counts.coordinateMatches).toBe(100);
  expect(locations.counts.outsideMapBounds).toBe(35);
  expect(locations.coordinateSource?.snapshotDate).toBe("2026-08-14");
  const rows = locateSales(data, locations);
  expect(rows).toHaveLength(65);
  expect(rows.every((s) => inBounds(s.position, REGION.bounds))).toBe(true);
  expect(rows[0].position).toEqual([-0.9536733, 51.4526991]);
  expect(rows[0].price).toBe(195000);
  expect(rows.every((s) => !("buildingId" in s))).toBe(true);
  expect(
    locateSales(data, { ...locations, coordinateSource: undefined }),
  ).toEqual([]);
});
it("compares real source-linked sales by distance and excludes the selected UPRN", () => {
  const rows = locateSales(data, locations);
  const subject = rows[0];
  const matches = findComparableSales(
    subject,
    rows.filter((s) => s.category === "A"),
    { radiusMetres: 1000, maxAgeMonths: 24, asOf: "2026-10-03" },
  );
  expect(matches).toHaveLength(4);
  expect(matches.map((s) => Math.round(s.distanceMetres))).toEqual([
    523, 526, 867, 971,
  ]);
  expect(matches.every((s) => s.propertyRef !== subject.propertyRef)).toBe(
    true,
  );
  expect(
    findComparableSales(subject, rows, {
      radiusMetres: 250,
      maxAgeMonths: 24,
      asOf: "2026-10-03",
    }),
  ).toEqual([]);
});
it("rejects missing evidence, reversed coordinates and false coverage counts", () => {
  expect(() =>
    saleLocationsSchema.parse({ ...locations, coordinateSource: undefined }),
  ).toThrow();
  expect(() =>
    saleLocationsSchema.parse({
      ...locations,
      counts: { ...locations.counts, outsideMapBounds: 0 },
    }),
  ).toThrow();
  expect(() =>
    saleLocationsSchema.parse({
      ...locations,
      coordinates: locations.coordinates.map((p) => ({
        ...p,
        position: [p.position[1], p.position[0]],
      })),
    }),
  ).toThrow();
});
