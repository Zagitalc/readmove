import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { joinUprnLookup } from "../../scripts/property/uprn";
import { mergeUprnLookups } from "../../scripts/property/merge-uprn";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
import {
  locateSales,
  nearbySales,
  selectSaleFilters,
  type SoldFilters,
} from "../../src/property/located-sales";
const a = "{00000000-0000-0000-0000-000000000001}";
const b = "{00000000-0000-0000-0000-000000000002}";
const c = "{00000000-0000-0000-0000-000000000003}";
const ids = new Set([a, b, c]);
const join = (text: string) => joinUprnLookup(Readable.from([text]), ids);
it("merges exact pairs across releases, preserving all evidence and excluding conflicts regardless of order", async () => {
  const july = await join(`${a},123\n${b},456\n${c},111\n${c},222\n`);
  const august = await join(`${a},123\n${a},123\n${b},789\n${c},111\n`);
  const result = mergeUprnLookups([july, august], ids);
  expect(result.identifiers).toEqual([
    {
      transactionId: a,
      uprn: "123",
      sourceHashes: [july.sha256, august.sha256].sort(),
    },
  ]);
  expect(result.ambiguous.map((a) => a.transactionId)).toEqual([b, c]);
  expect(result.ambiguous[1].mappings[0].sourceHashes).toHaveLength(2);
  expect(result.unmatched).toBe(0);
  expect(mergeUprnLookups([august, july, july], ids)).toEqual(result);
  expect(august.duplicateRows).toBe(1);
});
const asset = () =>
  JSON.parse(readFileSync("public/data/sale-locations.v2.json", "utf8"));
const sales = JSON.parse(
  readFileSync("public/data/sales-2025.v1.json", "utf8"),
);
it("binds published matches to exact sales bytes and audits actual in-bounds coverage", () => {
  const data = verifiedLocationsSchema.parse(asset());
  expect(data.salesAssetSha256).toBe(
    createHash("sha256")
      .update(readFileSync("public/data/sales-2025.v1.json"))
      .digest("hex"),
  );
  expect(data.counts).toEqual({
    residentialSales: 6325,
    identifierMatches: 246,
    unmatchedIdentifiers: 6079,
    ambiguousIdentifiers: 0,
    coordinateMatches: 246,
    outsideMapBounds: 69,
  });
  expect(data.sources.map((s) => s.rows)).toEqual([94112, 84149]);
  expect(
    data.identifiers.filter((i) => i.sourceHashes.length === 2),
  ).toHaveLength(1);
  expect(data.coordinateSource.releasePeriod).toBe("2026-09");
  expect(data.coordinateSource.snapshotDate).toBe("2026-08-14");
  expect(locateSales(sales, data).size).toBe(177);
  expect(data.coordinates).toHaveLength(245);
  expect(
    new Set([...locateSales(sales, data).values()].map((p) => p.uprn)).size,
  ).toBe(176);
  const saleIds = new Set(sales.records.map((s: { id: string }) => s.id));
  expect(data.identifiers.every((i) => saleIds.has(i.transactionId))).toBe(
    true,
  );
});
it("rejects missing provenance, unknown evidence, duplicate identities and conflicting/invalid coordinates", () => {
  const mutations = [
    (d: any) => {
      delete d.coordinateSource;
    },
    (d: any) => {
      d.identifiers[0].sourceHashes = [];
    },
    (d: any) => {
      d.identifiers[0].sourceHashes = ["0".repeat(64)];
    },
    (d: any) => {
      d.identifiers.push(d.identifiers[0]);
    },
    (d: any) => {
      d.coordinates.push({ ...d.coordinates[0], position: [-1, 51] });
    },
    (d: any) => {
      d.coordinates[0].position = [0, 100];
    },
    (d: any) => {
      d.coordinates[0].position = [0, 0];
    },
    (d: any) => {
      d.coordinates[0].position = [NaN, 51];
    },
    (d: any) => {
      d.coordinateSource.ambiguousUprns.push(d.coordinates[0].uprn);
    },
    (d: any) => {
      d.coordinates[0].uprn = "999999999999";
    },
  ];
  for (const change of mutations) {
    const data = asset();
    change(data);
    expect(() => verifiedLocationsSchema.parse(data)).toThrow();
  }
});
const filters: SoldFilters = {
  query: "RG1 4PF",
  type: "",
  category: "A",
  identifierOnly: false,
  radius: 1000,
  since: "",
};
it("clears only address discovery on selection and compares beyond the searched postcode", () => {
  const located = locateSales(sales, asset());
  const selected = [...located.values()].find(
    (p) => p.sale.address.postcode === "RG1 4PF",
  )!;
  expect(
    selectSaleFilters({
      ...filters,
      type: "terraced",
      radius: 500,
      since: "2025-07-01",
    }),
  ).toEqual({
    ...filters,
    query: "",
    type: "terraced",
    radius: 500,
    since: "2025-07-01",
  });
  const rows = nearbySales(sales, located, selected, filters, "2026-10-03");
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.some((p) => p.sale.address.postcode !== "RG1 4PF")).toBe(true);
  expect(
    rows.every(
      (p) =>
        p.distance <= 1000 &&
        p.uprn !== selected.uprn &&
        p.sale.category === "A",
    ),
  ).toBe(true);
  const narrow = nearbySales(
    sales,
    located,
    selected,
    {
      ...filters,
      radius: 1000,
      type: "flat",
      category: "A",
      since: "2025-09-01",
    },
    "2025-11-01",
  );
  expect(narrow).toHaveLength(1);
  expect(
    narrow.every(
      (p) =>
        p.sale.type === "flat" &&
        p.sale.category === "A" &&
        p.distance <= 1000 &&
        p.sale.date >= "2025-09-01" &&
        p.sale.date <= "2025-11-01",
    ),
  ).toBe(true);
  expect(
    nearbySales(
      sales,
      located,
      selected,
      { ...filters, since: "2026-01-01" },
      "2026-10-03",
    ),
  ).toEqual([]);
});

it("does not normalise or fuzzily match transaction IDs", async () => {
  await expect(
    join("{abcdefab-0000-0000-0000-000000000001},123\n"),
  ).rejects.toThrow();
  const result = await join(`${a},123\n`);
  expect(mergeUprnLookups([result], new Set([a, b])).unmatched).toBe(1);
});
