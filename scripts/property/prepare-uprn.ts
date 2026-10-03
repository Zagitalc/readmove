import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { publishedSalesSchema } from "../../shared/published-sales";
import { saleLocationsSchema } from "../../shared/sale-locations";
import { joinUprnLookup } from "./uprn";
const [input, salesPath, output] = process.argv.slice(2);
if (!input || !salesPath || !output)
  throw new Error(
    "Usage: npm run data:sales:uprn -- raw/uprn-aug-2026/source.csv public/data/sales-2025.v1.json raw/uprn-prepared.json",
  );
const salesBytes = await readFile(salesPath);
const sales = publishedSalesSchema.parse(
  JSON.parse(salesBytes.toString("utf8")),
);
const result = await joinUprnLookup(
  createReadStream(input),
  new Set(sales.records.map((s) => s.id)),
);
// This is the exact reviewed monthly file, not a guessed historical lookup.
if (
  result.sha256 !==
  "4a21a086c786ad5f9bb66c6d16abb9b84514146abcd52e1f983fec72fc38524f"
)
  throw new Error(
    "Unreviewed lookup bytes; audit the source, period and schema before changing the pin",
  );
const data = saleLocationsSchema.parse({
  version: 1,
  salesAssetSha256: createHash("sha256").update(salesBytes).digest("hex"),
  source: {
    url: "https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-aug-2026.csv",
    sha256: result.sha256,
    retrievedOn: "2026-10-03",
    lastModified: "Mon, 28 Sep 2026 05:12:50 GMT",
    period: "2026-08",
    attribution: [
      "Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.",
      "UPRNs contain OS data © Crown copyright and database rights 2026. This data is licensed under the Open Government Licence v3.0.",
    ],
  },
  counts: {
    sourceRows: result.rows,
    residentialSales: sales.records.length,
    identifierMatches: result.identifiers.length,
    unmatchedIdentifiers: result.unmatched,
    ambiguousIdentifiers: result.ambiguous.length,
    coordinateMatches: 0,
    outsideMapBounds: 0,
  },
  identifiers: result.identifiers,
  coordinates: [],
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(data) + "\n", { flag: "wx" });
console.log(
  JSON.stringify({
    ...data.counts,
    duplicateCandidateRows: result.duplicateRows,
    ambiguous: result.ambiguous,
  }),
);
