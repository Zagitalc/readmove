import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { REGION } from "../../shared/config";
import { ingestPpd } from "./ppd";
import {
  coverageAudit,
  DOWNLOADS_PAGE,
  TERMS_PAGE,
  receiptSchema,
  releaseSchema,
  validateSequence,
  verifyPrevious,
} from "./official-source";

const args = process.argv.slice(2);
const allowed = new Set([
  "--url",
  "--source-date",
  "--kind",
  "--year",
  "--output",
  "--previous",
  "--links",
]);
const flags = new Map<string, string>();
if (args.length === 1 && args[0] === "--help") {
  console.log(`Download and audit official HM Land Registry CSVs (curl and Node 24+ required).
Choose an HTTPS CSV link and publisher date from ${DOWNLOADS_PAGE}
Read the current conditions at ${TERMS_PAGE}

npm run data:sales:official -- --url HTTPS_CSV_URL --source-date YYYY-MM-DD --kind annual --year YYYY --output raw/official-YYYY
For monthly updates: --kind monthly --previous raw/previous-release --output raw/new-release
Optional: --links raw/reviewed-links.json

Output must be a NEW directory. Downloads and generated records stay in ignored raw/.
No publication, map matching, commit or push occurs.`);
  process.exit(0);
}
for (let i = 0; i < args.length; i += 2) {
  if (
    !allowed.has(args[i]) ||
    flags.has(args[i]) ||
    !args[i + 1] ||
    args[i + 1].startsWith("--")
  )
    throw new Error(
      "Invalid or duplicate option. Run npm run data:sales:official -- --help",
    );
  flags.set(args[i], args[i + 1]);
}
const release = releaseSchema.parse({
  url: flags.get("--url"),
  sourceDate: flags.get("--source-date"),
  kind: flags.get("--kind"),
  year: flags.has("--year") ? Number(flags.get("--year")) : undefined,
});
if (release.sourceDate > new Date().toISOString().slice(0, 10))
  throw new Error("Publisher date cannot be in the future");
const outputArg = flags.get("--output");
if (!outputArg) throw new Error("Supply --output raw/new-release");
const output = resolve(outputArg);
// Keep national CSVs and unpublished addresses out of Git and static assets.
const rawRoot = resolve("raw") + "/";
if (!output.startsWith(rawRoot))
  throw new Error(
    "Official imports must remain under the ignored raw/ directory",
  );
try {
  await lstat(output);
  throw new Error("Output already exists; choose a new release directory");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const previousDir = flags.get("--previous");
const previous = previousDir
  ? verifyPrevious(
      await read(join(previousDir, "sales.json")),
      await read(join(previousDir, "receipt.json")),
    )
  : undefined;
validateSequence(release, previous);
const links = flags.has("--links")
  ? await read(flags.get("--links")!)
  : undefined;
await mkdir(dirname(output), { recursive: true });
const staging = await mkdtemp(join(dirname(output), ".official-import-"));
try {
  const csv = join(staging, "source.csv");
  console.log(
    `Downloading ${release.url} using HTTPS; this may be a large national file…`,
  );
  const { stdout } = await promisify(execFile)("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--proto",
    "=https",
    "--connect-timeout",
    "30",
    "--max-time",
    "3600",
    "--output",
    csv,
    "--write-out",
    "%{http_code}",
    release.url,
  ]);
  // Intentionally no redirects: an unexpected location must be reviewed explicitly.
  if (stdout !== "200")
    throw new Error(
      `Expected HTTP 200 from the official file host; received ${stdout}`,
    );
  const retrievedAt = new Date().toISOString();
  const snapshot = await ingestPpd(createReadStream(csv), {
    sourceDate: release.sourceDate,
    bounds: REGION.bounds,
    outcodes: REGION.ppdOutcodes,
    previous: previous?.snapshot,
    links,
    provenance: {
      source: "HM Land Registry Price Paid Data",
      date: release.sourceDate,
      license: "OGL v3.0 (with PPD address-data conditions)",
      quality: "mapped",
      url: release.url,
    },
  });
  if (
    previous &&
    snapshot.appliedFiles.length === previous.snapshot.appliedFiles.length
  )
    throw new Error(
      "These bytes were already applied; preserve the existing release and check the publisher update.",
    );
  const receipt = receiptSchema.parse({
    version: 1,
    release,
    retrievedAt,
    sha256: snapshot.appliedFiles.at(-1),
    bytes: (await stat(csv)).size,
    downloadsPage: DOWNLOADS_PAGE,
    termsPage: TERMS_PAGE,
    attribution: `Contains HM Land Registry data © Crown copyright and database right ${release.sourceDate.slice(0, 4)}. This data is licensed under the Open Government Licence v3.0.`,
    baseline: previous?.receipt.baseline ?? release,
  });
  const audit = coverageAudit(snapshot, receipt);
  for (const [name, value] of Object.entries({
    "sales.json": snapshot,
    "receipt.json": receipt,
    "audit.json": audit,
  }))
    await writeFile(
      join(staging, name),
      JSON.stringify(value, null, name === "sales.json" ? undefined : 2) + "\n",
    );
  await rename(staging, output);
  console.log(
    `Saved ${output}: ${snapshot.records.length} postcode candidates; ${snapshot.matches.length} documented in-bounds matches; ${snapshot.unmatchedCount} unmatched. Review audit.json. Nothing published.`,
  );
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}
