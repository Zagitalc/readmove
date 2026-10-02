import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { REGION } from "../../shared/config";
import { ingestPpd, parsePpdRow } from "../../scripts/property/ppd";
import {
  findComparableSales,
  type LocatedSale,
} from "../../src/property/comparables";
import type { Provenance } from "../../shared/types";

const id = "{00000000-0000-0000-0000-000000000001}";
const id2 = "{00000000-0000-0000-0000-000000000002}";
const provenance: Provenance = {
  source: "TEST FIXTURE",
  date: "2026-09-01",
  license: "CC0",
  quality: "fixture",
};
const base = [
  id,
  "400000",
  "2025-04-04 00:00",
  "RG1 1AA",
  "T",
  "N",
  "F",
  "10",
  "",
  "KING, STREET",
  "",
  "READING",
  "READING",
  "BERKSHIRE",
  "A",
  "A",
];
const csv = (rows: string[][]) =>
  rows
    .map((row) =>
      row.map((value) => '"' + value.replaceAll('"', '""') + '"').join(","),
    )
    .join("\r\n");
const input = (rows: string[][]) => Readable.from([Buffer.from(csv(rows))]);
const options = {
  sourceDate: "2026-09-01",
  bounds: REGION.bounds,
  outcodes: REGION.ppdOutcodes,
};
const link = {
  transactionId: id,
  propertyRef: "uprn:100000001",
  uprn: "100000001",
  position: [-0.971, 51.458],
  method: "official-uprn-lookup",
  evidenceUrl: "https://example.org/test-only-lookup",
  matchedOn: "2026-09-01",
};

describe("Price Paid Data ingestion", () => {
  it("propagates source read failures without producing a partial snapshot", async () => {
    async function* broken() {
      yield Buffer.from(csv([base]) + "\n");
      throw new Error("Source read failed");
    }
    await expect(ingestPpd(broken(), options)).rejects.toThrow(
      "Source read failed",
    );
  });
  it("parses quoted CSV and retains candidate transactions without inventing geographic links", async () => {
    const result = await ingestPpd(input([base]), options);
    expect(result.records[0].address.street).toBe("KING, STREET");
    expect(result.records[0].type).toBe("terraced");
    expect(result.records[0].price).toBe(400000);
    expect(result.records[0]).not.toHaveProperty("propertyRef");
    expect(result.unmatchedCount).toBe(1);
    expect(result.matches).toEqual([]);
  });
  it("applies corrections and deletions by transaction ID and removes obsolete links", async () => {
    const before = await ingestPpd(input([base, [id2, ...base.slice(1)]]), {
      ...options,
      links: [link],
    });
    const correction = [...base];
    correction[1] = "425000";
    correction[15] = "C";
    const deletion = [id2, ...Array(14).fill(""), "D"];
    const after = await ingestPpd(input([correction, deletion]), {
      ...options,
      sourceDate: "2026-10-01",
      previous: before,
    });
    expect(after.records).toHaveLength(1);
    expect(after.records[0].price).toBe(425000);
    expect(after.matches).toHaveLength(1);
    const changed = [...correction];
    changed[7] = "12";
    const rematched = await ingestPpd(input([changed]), {
      ...options,
      sourceDate: "2026-11-01",
      previous: after,
    });
    expect(rematched.matches).toEqual([]);
    expect(rematched.unmatchedCount).toBe(1);
  });
  it("is idempotent, rejects out-of-order updates and can attach documented matches separately", async () => {
    const before = await ingestPpd(input([base]), options);
    expect(
      await ingestPpd(input([base]), { ...options, previous: before }),
    ).toEqual(before);
    const linked = await ingestPpd(input([base]), {
      ...options,
      previous: before,
      links: [link],
    });
    expect(linked.matches).toHaveLength(1);
    expect(linked.appliedFiles).toHaveLength(1);
    const changed = [...base];
    changed[1] = "500000";
    changed[15] = "C";
    await expect(
      ingestPpd(input([changed]), {
        ...options,
        sourceDate: "2026-08-01",
        previous: before,
      }),
    ).rejects.toThrow("in order");
  });
  it("distinguishes postcode candidates, true coordinate coverage and unmatched records", async () => {
    const london = [...base];
    london[0] = id2;
    london[3] = "SW1A 1AA";
    const result = await ingestPpd(input([base, london]), {
      ...options,
      links: [{ ...link, position: [-0.1, 51.5] }],
    });
    expect(result.records).toHaveLength(1);
    expect(result.matches).toEqual([]);
    expect(result.outsideCoverage).toHaveLength(1);
    expect(result.unmatchedCount).toBe(0);
    const moved = [...base];
    moved[3] = "SW1A 1AA";
    moved[15] = "C";
    expect(
      (
        await ingestPpd(input([moved]), {
          ...options,
          previous: result,
          sourceDate: "2026-10-01",
        })
      ).records,
    ).toEqual([]);
  });
  it("rejects invalid prices, dates, types, missing columns, ambiguous links and empty files", async () => {
    for (const [column, value] of [
      [1, "-1"],
      [1, "0"],
      [2, "2025-02-30 00:00"],
      [4, "X"],
      [15, "X"],
    ] as const) {
      const invalid = [...base];
      invalid[column] = value;
      expect(() => parsePpdRow(invalid, provenance)).toThrow();
    }
    expect(() => parsePpdRow(base.slice(1), provenance)).toThrow("16");
    await expect(
      ingestPpd(input([base]), { ...options, links: [link, link] }),
    ).rejects.toThrow("Duplicate");
    await expect(ingestPpd(Readable.from([]), options)).rejects.toThrow(
      "Empty",
    );
  });
});

describe("source-aware comparable filters", () => {
  const subject = {
    propertyRef: "home",
    position: [-0.97, 51.458] as [number, number],
    provenance,
  };
  const sale: LocatedSale = {
    id: "sale",
    propertyRef: "neighbour",
    position: [-0.969, 51.458],
    price: 400000,
    date: "2026-08-01",
    type: "terraced",
    provenance,
  };
  const filters = { radiusMetres: 500, maxAgeMonths: 12, asOf: "2026-10-02" };
  it("enforces distance, date, type and inclusive price limits", () => {
    expect(
      findComparableSales(subject, [sale], {
        ...filters,
        type: "terraced",
        minPrice: 400000,
        maxPrice: 400000,
      }),
    ).toHaveLength(1);
    for (const override of [
      { radiusMetres: 5 },
      { type: "flat" as const },
      { maxPrice: 399999 },
      { minPrice: 400001 },
    ]) {
      expect(
        findComparableSales(subject, [sale], { ...filters, ...override }),
      ).toEqual([]);
    }
    expect(
      findComparableSales(
        subject,
        [
          { ...sale, date: "2024-01-01" },
          { ...sale, date: "2027-01-01" },
        ],
        filters,
      ),
    ).toEqual([]);
    expect(() =>
      findComparableSales(subject, [sale], {
        ...filters,
        minPrice: 500,
        maxPrice: 1,
      }),
    ).toThrow();
  });
  it("excludes the subject and prevents fixture/real-data mixing", () => {
    expect(
      findComparableSales(
        subject,
        [
          { ...sale, propertyRef: "home" },
          { ...sale, provenance: { ...provenance, quality: "mapped" } },
        ],
        filters,
      ),
    ).toEqual([]);
  });
  it("clamps calendar lookbacks and sorts deterministically by distance", () => {
    const endOfMonth = { ...filters, asOf: "2026-03-31", maxAgeMonths: 1 };
    expect(
      findComparableSales(
        subject,
        [{ ...sale, date: "2026-02-28" }],
        endOfMonth,
      ),
    ).toHaveLength(1);
    const rows = findComparableSales(
      subject,
      [
        { ...sale, id: "far", position: [-0.967, 51.458] },
        { ...sale, id: "near" },
      ],
      filters,
    );
    expect(rows.map((r) => r.id)).toEqual(["near", "far"]);
  });
});
