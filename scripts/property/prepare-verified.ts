import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { publishedSalesSchema } from "../../shared/published-sales";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
import { inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
import { joinUprnLookup } from "./uprn";
import { mergeUprnLookups } from "./merge-uprn";
const [salesPath, july, august, coordinatesPath, output] =
  process.argv.slice(2);
if (!output)
  throw new Error(
    "Usage: tsx scripts/property/prepare-verified.ts sales.json july.csv august.csv coordinates.json|- NEW_OUTPUT.json",
  );
const salesBytes = await readFile(salesPath);
const sales = publishedSalesSchema.parse(JSON.parse(salesBytes.toString()));
const ids = new Set(sales.records.map((s) => s.id));
const releases = await Promise.all(
  [july, august].map((p) => joinUprnLookup(createReadStream(p), ids)),
);
const pins = [
  "1d05becac589365a0f87b81f06b9a79c83281a600f49267b7f18a36f91ef3254",
  "4a21a086c786ad5f9bb66c6d16abb9b84514146abcd52e1f983fec72fc38524f",
];
if (releases.some((r, i) => r.sha256 !== pins[i]))
  throw new Error("Unreviewed lookup bytes");
const merged = mergeUprnLookups(releases, ids);
if (coordinatesPath === "-") {
  await writeFile(output, JSON.stringify(merged) + "\n", { flag: "wx" });
} else {
  const os = JSON.parse(await readFile(coordinatesPath, "utf8"));
  if (
    os.sha256 !==
      "107503d45bedaab7f74511766eedbd617f9ca3592113363711e94f4b6458d55a" ||
    os.csvSha256 !==
      "aafe9a43365469f8b57954583344947b8f877266b88b1d92823cd67259cecd98" ||
    os.rows !== 41676575
  )
    throw new Error("Unreviewed coordinate source");
  const points = new Map<string, [number, number]>(
    os.coordinates.map((c: { uprn: string; position: [number, number] }) => [
      c.uprn,
      c.position,
    ]),
  );
  const located = merged.identifiers.filter((i) => points.has(i.uprn));
  const prior = JSON.parse(
    await readFile("public/data/sale-locations.v1.json", "utf8"),
  );
  const data = verifiedLocationsSchema.parse({
    version: 2,
    salesAssetSha256: createHash("sha256").update(salesBytes).digest("hex"),
    sources: releases.map((r, i) => ({
      ...prior.source,
      url: `https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-${i ? "aug" : "jul"}-2026.csv`,
      period: i ? "2026-08" : "2026-07",
      sha256: r.sha256,
      rows: r.rows,
      bytes: r.bytes,
      lastModified: "Mon, 28 Sep 2026 05:12:50 GMT",
      retrievedOn: "2026-10-03",
    })),
    identifiers: merged.identifiers,
    ambiguous: merged.ambiguous,
    coordinates: os.coordinates,
    coordinateSource: {
      product: "OS Open UPRN",
      url: "https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect",
      sha256: os.sha256,
      csvSha256: os.csvSha256,
      member: os.member,
      releasePeriod: "2026-09",
      snapshotDate: "2026-08-14",
      retrievedOn: "2026-10-03",
      rows: os.rows,
      ambiguousUprns: os.ambiguousUprns,
      attribution:
        "Contains Ordnance Survey data © Crown copyright and database right 2026. Licensed under the Open Government Licence v3.0.",
    },
    counts: {
      residentialSales: ids.size,
      identifierMatches: merged.identifiers.length,
      unmatchedIdentifiers: merged.unmatched,
      ambiguousIdentifiers: merged.ambiguous.length,
      coordinateMatches: located.length,
      outsideMapBounds: located.filter(
        (i) => !inBounds(points.get(i.uprn), REGION.bounds),
      ).length,
    },
  });
  await writeFile(output, JSON.stringify(data) + "\n", { flag: "wx" });
  console.log(data.counts);
}
console.log(
  releases.map((r) => ({
    rows: r.rows,
    matches: r.identifiers.length,
    duplicates: r.duplicateRows,
    sha256: r.sha256,
  })),
);
