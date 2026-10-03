import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { publishedSalesSchema } from "../../shared/published-sales";
import { filterSoldPrices } from "../../src/property/sold-prices";
const raw = JSON.parse(readFileSync("public/data/sales-2025.v1.json", "utf8"));
const data = publishedSalesSchema.parse(raw);
it("validates the audited official residential snapshot without invented coordinates", () => {
  expect(data.counts).toEqual({
    candidates: 6593,
    residential: 6325,
    excludedOther: 268,
    coordinateMatches: 0,
  });
  expect(data.source.sha256).toBe(
    "83540b18086e5748116c744d9e930ad210cafcbb01a5d7d41fcbd2464ba0b5fd",
  );
  expect(
    data.records.every(
      (r) => r.type !== "other" && !("position" in r) && !("propertyRef" in r),
    ),
  ).toBe(true);
  expect(
    data.records.every((r, i) => !i || r.date <= data.records[i - 1].date),
  ).toBe(true);
  expect(() =>
    publishedSalesSchema.parse({
      ...raw,
      records: [...raw.records, raw.records[0]],
    }),
  ).toThrow();
});
it("searches sold addresses including compact postcodes and keeps category/type filters", () => {
  const spaced = filterSoldPrices(data, "rg31 5nq", "", "A");
  expect(spaced.length).toBeGreaterThan(0);
  expect(filterSoldPrices(data, "RG315NQ", "", "A")).toEqual(spaced);
  expect(
    filterSoldPrices(data, "woodbridge", "", "A").some(
      (r) => r.address.paon === "2" && r.price === 360000,
    ),
  ).toBe(true);
  expect(filterSoldPrices(data, "ZZ99 impossible", "", "")).toEqual([]);
  const flats = filterSoldPrices(data, "", "flat", "B");
  expect(flats.length).toBeGreaterThan(0);
  expect(flats.every((r) => r.category === "B" && r.type === "flat")).toBe(
    true,
  );
});
