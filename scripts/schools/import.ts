/**
 * Builds public/data/schools.v1.json from the DfE GIAS "all establishment data"
 * CSV. Node 24.
 *   npm run data:schools -- --date 20261018          download (or reuse cache)
 *   npm run data:schools -- --date 20261018 --offline
 * The CSV is cp1252, ~65 MB, cached with a receipt under ignored raw/schools/.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { REGION } from "../../shared/config";
import { GIAS_DOWNLOADS, OGL_URL, schoolsSchema } from "../../shared/schools";
import { buildSchools } from "./build";

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const date = args[args.indexOf("--date") + 1];
if (!/^\d{8}$/.test(date ?? ""))
  throw new Error("Pass --date YYYYMMDD (the GIAS extract date)");
const output = process.env.SCHOOLS_OUTPUT ?? "public/data/schools.v1.json";
const url = `https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata${date}.csv`;
const file = `raw/schools/edubasealldata${date}.csv`;
const sha = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

await mkdir("raw/schools", { recursive: true });
let bytes: Buffer, retrievedOn: string;
try {
  const receipt = JSON.parse(await readFile(file + ".json", "utf8"));
  bytes = await readFile(file);
  if (receipt.url !== url || receipt.sha256 !== sha(bytes))
    throw new Error("Cached GIAS file disagrees with its receipt");
  retrievedOn = receipt.retrievedOn;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  if (offline) throw new Error(`Offline source missing: ${file}`);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!response.ok) throw new Error(`GIAS HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000_000)
    throw new Error("GIAS file is implausibly small");
  retrievedOn = new Date().toISOString().slice(0, 10);
  await writeFile(file, bytes);
  await writeFile(
    file + ".json",
    JSON.stringify({ url, sha256: sha(bytes), retrievedOn }, null, 2) + "\n",
  );
}
// GIAS publishes Windows-1252; decoding as UTF-8 would corrupt apostrophes.
const { schools, counts } = buildSchools(
  new TextDecoder("windows-1252").decode(bytes),
  REGION.bounds,
);
const asset = schoolsSchema.parse({
  version: 1,
  source: {
    name: "Get Information about Schools (DfE)",
    url,
    extractDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
    retrievedOn,
    sha256: sha(bytes),
    bytes: bytes.length,
    downloadsPage: GIAS_DOWNLOADS,
    licence: "Open Government Licence v3.0",
    licenceUrl: OGL_URL,
    attribution:
      "Contains public sector information from Get Information about Schools, Department for Education, licensed under the Open Government Licence v3.0",
  },
  coordinates: {
    sourceCrs: "EPSG:27700 (British National Grid)",
    method:
      "Published easting/northing converted with the OS 7-parameter Helmert OSGB36→WGS84 shift, rounded to 6 decimal places",
    approximateAccuracyMetres: 5,
  },
  selection: `Establishments with status Open or Open, but proposed to close whose converted position lies inside [${REGION.bounds.join(", ")}]. Establishments without published coordinates are omitted.`,
  counts,
  schools,
});
await writeFile(output, JSON.stringify(asset) + "\n");
console.log(
  `${counts.sourceRows} rows → ${schools.length} open schools in the map box (${counts.closedInBounds} closed ignored, ${counts.missingCoordinates} without coordinates) → ${output}`,
);
