import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { joinUprnLookup } from "../../scripts/property/uprn";
import { saleLocationsSchema } from "../../shared/sale-locations";
const a = "{00000000-0000-0000-0000-000000000001}";
const b = "{00000000-0000-0000-0000-000000000002}";
const c = "{00000000-0000-0000-0000-000000000003}";
const input = (text: string) => Readable.from([text]);
it("joins exact transaction IDs and excludes ambiguous matches rather than choosing a UPRN", async () => {
  const result = await joinUprnLookup(
    input(`${a},123\n${a},123\n${b},456\n${b},789\n${c},999\n`),
    new Set([a, b, "{00000000-0000-0000-0000-000000000004}"]),
  );
  expect(result.identifiers).toEqual([{ transactionId: a, uprn: "123" }]);
  expect(result.ambiguous).toEqual([
    { transactionId: b, uprns: ["456", "789"] },
  ]);
  expect(result.unmatched).toBe(1);
  expect(result.duplicateRows).toBe(1);
  expect(result.rows).toBe(5);
});
it("rejects malformed identifiers, missing fields, empty input and broken streams", async () => {
  for (const text of [
    `${a},not-a-uprn`,
    `${a},0`,
    `${a},1234567890123`,
    `${a},123,extra`,
    "",
    `bad,123`,
  ])
    await expect(joinUprnLookup(input(text), new Set([a]))).rejects.toThrow();
  async function* broken() {
    yield `${a},123\n`;
    throw new Error("Broken download");
  }
  await expect(joinUprnLookup(broken(), new Set([a]))).rejects.toThrow(
    "Broken download",
  );
});
it("validates the audited lookup against the exact published sale asset and keeps identifiers unlocated", () => {
  const data = saleLocationsSchema.parse(
    JSON.parse(readFileSync("public/data/sale-locations.v1.json", "utf8")),
  );
  const bytes = readFileSync("public/data/sales-2025.v1.json");
  expect(data.salesAssetSha256).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  const ids = new Set(
    JSON.parse(bytes.toString()).records.map((r: { id: string }) => r.id),
  );
  expect(data.identifiers.every((i) => ids.has(i.transactionId))).toBe(true);
  expect(data.counts).toEqual({
    sourceRows: 84149,
    residentialSales: 6325,
    identifierMatches: 100,
    unmatchedIdentifiers: 6225,
    ambiguousIdentifiers: 0,
    coordinateMatches: 0,
    outsideMapBounds: 0,
  });
  expect(data.coordinates).toEqual([]);
  expect(data.coordinateSource).toBeUndefined();
  expect(() =>
    saleLocationsSchema.parse({
      ...data,
      coordinates: [
        { uprn: data.identifiers[0].uprn, position: [-0.97, 51.45] },
      ],
    }),
  ).toThrow();
  expect(() =>
    saleLocationsSchema.parse({
      ...data,
      identifiers: [...data.identifiers, data.identifiers[0]],
    }),
  ).toThrow();
});
