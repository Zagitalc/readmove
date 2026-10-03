// Generates the reviewed residential price-display asset locally; does not deploy it.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { publishedSalesSchema } from "../../shared/published-sales";
import { verifyPrevious } from "./official-source";
import { ingestPpd } from "./ppd";

const input = process.argv[2],
  output = process.argv[3];
if (!input || !output)
  throw new Error(
    "Usage: npm run data:sales:prepare -- raw/official-2025-2026-09-28 public/data/sales-2025.v1.json",
  );
const read = async (name: string) =>
  JSON.parse(await readFile(join(input, name), "utf8"));
const { snapshot, receipt } = verifyPrevious(
  await read("sales.json"),
  await read("receipt.json"),
);
if (
  receipt.release.kind !== "annual" ||
  receipt.release.year !== 2025 ||
  snapshot.matches.length ||
  snapshot.outsideCoverage.length
)
  throw new Error(
    "This first publication supports only the reviewed, unlocated 2025 annual baseline",
  );
const hash = createHash("sha256");
for await (const chunk of createReadStream(join(input, "source.csv")))
  hash.update(chunk);
if (hash.digest("hex") !== receipt.sha256)
  throw new Error("Original CSV checksum differs from its receipt");
// Pin the reviewed release. A future release needs its own source-date/terms review.
if (
  receipt.sha256 !==
    "83540b18086e5748116c744d9e930ad210cafcbb01a5d7d41fcbd2464ba0b5fd" ||
  receipt.release.sourceDate !== "2026-09-28"
)
  throw new Error(
    "Unreviewed release; update this preparation contract after auditing its source and scope",
  );
const rebuilt = await ingestPpd(createReadStream(join(input, "source.csv")), {
  sourceDate: receipt.release.sourceDate,
  bounds: snapshot.bounds,
  outcodes: snapshot.candidateOutcodes,
  provenance: snapshot.provenance,
});
if (
  JSON.stringify(rebuilt.records) !== JSON.stringify(snapshot.records) ||
  JSON.stringify(rebuilt.importAudit) !== JSON.stringify(snapshot.importAudit)
)
  throw new Error(
    "Snapshot records or audit disagree with the original publisher CSV",
  );
const records = snapshot.records
  .filter((r) => r.type !== "other")
  .map(({ provenance: _, ...record }) => record)
  .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
const published = publishedSalesSchema.parse({
  version: 1,
  source: {
    name: "HM Land Registry Price Paid Data",
    url: receipt.release.url,
    sourceDate: receipt.release.sourceDate,
    sourceDateBasis: "Publisher file Last-Modified date",
    retrievedAt: receipt.retrievedAt,
    sha256: receipt.sha256,
    attribution: receipt.attribution,
    termsUrl: receipt.termsPage,
    scope: "2025 annual file · partial history",
  },
  outcodes: snapshot.candidateOutcodes,
  counts: {
    candidates: snapshot.records.length,
    residential: records.length,
    excludedOther: snapshot.records.length - records.length,
    coordinateMatches: 0,
  },
  records,
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(published) + "\n", { flag: "wx" });
console.log(
  `Prepared ${records.length} residential transaction records; ${published.counts.excludedOther} type Other excluded. No coordinates inferred. No deployment.`,
);
