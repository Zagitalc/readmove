import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  defaultSoldFilters,
  filterSummary,
  sortSales,
  uprnHistory,
} from "../../src/property/comparable-sales";
import { publishedSalesSchema } from "../../shared/published-sales";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
const data = publishedSalesSchema.parse(
  JSON.parse(readFileSync("public/data/sales-2025.v1.json", "utf8")),
);
const locations = verifiedLocationsSchema.parse(
  JSON.parse(readFileSync("public/data/sale-locations.v2.json", "utf8")),
);
it("sorts full sets without mutation, with deterministic ties and missing distances last", () => {
  const base = data.records[0];
  const rows = [
    { ...base, id: "c", date: "2025-02-01", price: 300 },
    { ...base, id: "b", date: "2025-01-01", price: 100 },
    { ...base, id: "a", date: "2025-01-01", price: 100 },
  ];
  const ids = (s: typeof rows) => s.map((r) => r.id);
  expect(ids(sortSales(rows, "price-low"))).toEqual(["a", "b", "c"]);
  expect(ids(sortSales(rows, "price-high"))).toEqual(["c", "a", "b"]);
  expect(ids(sortSales(rows, "oldest"))).toEqual(["a", "b", "c"]);
  expect(ids(sortSales(rows, "newest"))).toEqual(["c", "a", "b"]);
  expect(
    ids(
      sortSales(
        rows,
        "distance",
        new Map([
          ["b", 10],
          ["c", 20],
        ]),
      ),
    ),
  ).toEqual(["b", "c", "a"]);
  expect(ids(rows)).toEqual(["c", "b", "a"]);
});
it("history excludes shared addresses/positions, unmatched, ambiguous and future transactions", () => {
  const base = data.records[0];
  const records = ["a", "b", "c", "d", "e"].map((id) => ({
    ...base,
    id,
    date: id === "b" ? "2027-01-01" : "2025-01-01",
  }));
  const fixture = {
    ...locations,
    identifiers: [
      { transactionId: "a", uprn: "123", sourceHashes: [] },
      { transactionId: "b", uprn: "123", sourceHashes: [] },
      { transactionId: "c", uprn: "456", sourceHashes: [] },
    ],
    ambiguous: [
      {
        transactionId: "d",
        mappings: [
          { uprn: "123", sourceHashes: [] },
          { uprn: "456", sourceHashes: [] },
        ],
      },
    ],
  };
  expect(
    uprnHistory({ ...data, records }, fixture, "123", "2026-10-07").map(
      (s) => s.id,
    ),
  ).toEqual(["a"]);
});
it("finds repeated official UPRNs independently of comparison filters", () => {
  const counts = new Map<string, number>();
  locations.identifiers.forEach((i) =>
    counts.set(i.uprn, (counts.get(i.uprn) ?? 0) + 1),
  );
  const uprn = [...counts].find(([, n]) => n > 1)![0];
  expect(uprnHistory(data, locations, uprn, "2026-10-07")).toHaveLength(2);
});
it("summarizes only active controls and resets with independent defaults", () => {
  const f = {
    ...defaultSoldFilters(),
    query: "RG1",
    identifierOnly: true,
    radius: 500,
    since: "2025-06-01",
  };
  expect(filterSummary(f, true, true)).toBe(
    "All residential types · Category A · Within 500 m · Since 2025-06-01",
  );
  expect(filterSummary(f, false, true)).toContain(
    "Search: RG1 · Official UPRN only · In-map locations only",
  );
  const fresh = defaultSoldFilters();
  fresh.type = "flat";
  expect(defaultSoldFilters().type).toBe("");
});
