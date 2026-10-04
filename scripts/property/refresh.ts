import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { refreshPlanSchema } from "./refresh-plan";
import { acquire } from "./refresh-source";
import { compareCoverage } from "./refresh-report";
import { joinUprnLookup } from "./uprn";
import { mergeUprnLookups } from "./merge-uprn";
import { publishedSalesSchema } from "../../shared/published-sales";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
import { inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    run: { type: "string" },
    "source-root": { type: "string" },
    offline: { type: "boolean", default: false },
  },
});
if (
  !values.manifest ||
  !values.run ||
  !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(values.run)
)
  throw new Error(
    "Usage: npm run data:refresh -- --manifest config/property-refresh.json --run UNIQUE_NAME [--source-root PATH] [--offline]",
  );
const root = fileURLToPath(new URL("../../", import.meta.url));
const plan = refreshPlanSchema.parse(
  JSON.parse(await readFile(resolve(values.manifest), "utf8")),
);
const salesBytes = await readFile(resolve(root, plan.sales.path));
const sha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
if (sha(salesBytes) !== plan.sales.sha256)
  throw new Error("Sales snapshot checksum changed; review it separately");
const sales = publishedSalesSchema.parse(JSON.parse(salesBytes.toString()));
const baseline = verifiedLocationsSchema.parse(
  JSON.parse(await readFile(resolve(root, plan.baseline), "utf8")),
);
if (baseline.salesAssetSha256 !== plan.sales.sha256)
  throw new Error("Baseline and sales snapshot disagree");
const output = join(root, "raw", "refresh", values.run);
await mkdir(join(root, "raw", "refresh"), { recursive: true });
await mkdir(output); // Exclusive run directory: never overwrite an existing candidate or report.
const json = async (name: string, value: unknown) =>
  writeFile(join(output, name), JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
try {
  await json("manifest.json", plan);
  const ids = new Set(sales.records.map((s) => s.id));
  if (
    baseline.counts.residentialSales !== ids.size ||
    [...baseline.identifiers, ...baseline.ambiguous].some(
      (i) => !ids.has(i.transactionId),
    )
  )
    throw new Error("Baseline identifiers do not belong to the sales snapshot");
  const lookups = [],
    sources = [],
    receipts = [];
  for (const source of plan.lookups) {
    const receipt = await acquire(
      source,
      resolve(values["source-root"] ?? root),
      join(root, "raw", "refresh-cache"),
      values.offline,
    );
    receipts.push({ url: source.url, sha256: source.sha256, ...receipt });
    const lookup = await joinUprnLookup(createReadStream(receipt.path), ids);
    if (lookup.rows !== source.rows || lookup.sha256 !== source.sha256)
      throw new Error("Lookup row count/hash mismatch");
    lookups.push(lookup);
    sources.push({
      ...source,
      retrievedOn: receipt.retrievedOn,
      lastModified: receipt.lastModified,
    });
  }
  const merged = mergeUprnLookups(lookups, ids);
  await json("identifiers.json", merged);
  const receipt = await acquire(
    plan.coordinates,
    resolve(values["source-root"] ?? root),
    join(root, "raw", "refresh-cache"),
    values.offline,
  );
  receipts.push({
    url: plan.coordinates.url,
    sha256: plan.coordinates.sha256,
    ...receipt,
  });
  console.log("Streaming and validating OS coordinate archive…");
  await new Promise<void>((ok, fail) => {
    const child = spawn(
      "python3",
      [
        join(root, "scripts/property/os_coordinates.py"),
        receipt.path,
        join(output, "identifiers.json"),
        join(output, "coordinates.json"),
        join(output, "manifest.json"),
      ],
      { stdio: "inherit" },
    );
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0
        ? ok()
        : fail(new Error(`Coordinate extraction exited ${code}`)),
    );
  });
  const coordinates = JSON.parse(
    await readFile(join(output, "coordinates.json"), "utf8"),
  );
  const points = new Map<string, [number, number]>(
    coordinates.coordinates.map(
      (c: { uprn: string; position: [number, number] }) => [c.uprn, c.position],
    ),
  );
  const located = merged.identifiers.filter((i) => points.has(i.uprn));
  const candidate = verifiedLocationsSchema.parse({
    version: 2,
    salesAssetSha256: plan.sales.sha256,
    sources,
    identifiers: merged.identifiers,
    ambiguous: merged.ambiguous,
    coordinates: coordinates.coordinates,
    coordinateSource: {
      ...plan.coordinates,
      retrievedOn: receipt.retrievedOn,
      ambiguousUprns: coordinates.ambiguousUprns,
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
  const bytes = JSON.stringify(candidate) + "\n";
  const report = {
    ...compareCoverage(baseline, candidate),
    createdAt: new Date().toISOString(),
    candidateSha256: sha(bytes),
    sources: receipts,
    lookupAudit: lookups.map((l) => ({
      sha256: l.sha256,
      rows: l.rows,
      duplicateRows: l.duplicateRows,
    })),
    coordinateDuplicateRows: coordinates.duplicateRows,
  };
  await json("report.json", report);
  await writeFile(join(output, "candidate.partial"), bytes, { flag: "wx" });
  await rename(
    join(output, "candidate.partial"),
    join(output, "sale-locations.v2.json"),
  );
  await json("COMPLETE.json", {
    candidateSha256: sha(bytes),
    reviewRequired: true,
  });
  console.log(
    JSON.stringify(
      {
        output,
        before: report.before,
        after: report.after,
        warnings: report.warnings,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await json("FAILED.json", {
    message: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
