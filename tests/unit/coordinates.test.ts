import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { publishedSalesSchema } from "../../shared/published-sales";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
import { inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
import { locateSales, nearbySales } from "../../src/property/located-sales";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const data = publishedSalesSchema.parse(read("public/data/sales-2025.v1.json"));
const locations = verifiedLocationsSchema.parse(
  read("public/data/sale-locations.v2.json"),
);
it("preserves every stage-6 August coordinate in the expanded official join", () => {
  const original = read("public/data/sale-coordinates.audit.json");
  const points = new Map(
    locations.coordinates.map((c) => [c.uprn, c.position]),
  );
  expect(original.matchedRows).toHaveLength(100);
  for (const row of original.matchedRows)
    expect(points.get(row.uprn)).toEqual(row.position);
  expect(
    original.matchedRows.filter((p: { position: unknown }) =>
      inBounds(p.position, REGION.bounds),
    ),
  ).toHaveLength(65);
  expect(locations.coordinateSource.snapshotDate).toBe(original.extractionDate);
  const rows = [...locateSales(data, locations).values()];
  expect(rows).toHaveLength(177);
  expect(rows.every((s) => !("buildingId" in s))).toBe(true);
  expect(locateSales(data).size).toBe(0);
});
it("keeps the original nearby comparisons and adds the newly located July sale", () => {
  const rows = locateSales(data, locations);
  const subject = [...rows.values()].find(
    (s) => s.sale.address.postcode === "RG1 4PF",
  )!;
  const filters = {
    query: "",
    type: "",
    category: "A",
    identifierOnly: false,
    radius: 1000,
    since: "2024-10-03",
  };
  const matches = nearbySales(data, rows, subject, filters, "2026-10-03");
  expect(matches.map((s) => Math.round(s.distance))).toEqual([
    523, 526, 798, 867, 971,
  ]);
  expect(matches.every((s) => s.uprn !== subject.uprn)).toBe(true);
  expect(
    nearbySales(data, rows, subject, { ...filters, radius: 250 }, "2026-10-03"),
  ).toEqual([]);
});
it("rejects missing coordinate evidence and reversed coordinates", () => {
  expect(() =>
    verifiedLocationsSchema.parse({
      ...locations,
      coordinateSource: undefined,
    }),
  ).toThrow();
  expect(() =>
    verifiedLocationsSchema.parse({
      ...locations,
      coordinates: locations.coordinates.map((c) => ({
        ...c,
        position: [c.position[1], c.position[0]],
      })),
    }),
  ).toThrow();
});
