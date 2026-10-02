import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { REGION } from "../../shared/config";
import { ingestPpd } from "./ppd";

const args = process.argv.slice(2);
const value = (name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const input = value("--input"),
  output = value("--output"),
  sourceDate = value("--source-date");
if (!input || !output || !sourceDate)
  throw new Error(
    "Usage: npm run data:sales -- --input raw/ppd.csv --output raw/sales.json --source-date YYYY-MM-DD [--previous raw/previous.json] [--links raw/links.json]",
  );
if (
  resolve(input) === resolve(output) ||
  (value("--previous") && resolve(value("--previous")!) === resolve(output))
)
  throw new Error(
    "Write to a new output file; preserve input and previous snapshot",
  );
const read = async (path?: string) =>
  path ? JSON.parse(await readFile(path, "utf8")) : undefined;
const snapshot = await ingestPpd(createReadStream(input), {
  sourceDate,
  bounds: REGION.bounds,
  outcodes: REGION.ppdOutcodes,
  previous: await read(value("--previous")),
  links: await read(value("--links")),
});
await mkdir(dirname(output), { recursive: true });
const temp = `${output}.${process.pid}.tmp`;
await writeFile(temp, JSON.stringify(snapshot));
await rename(temp, output);
console.log(
  `Imported ${snapshot.records.length} postcode-area candidates; ${snapshot.matches.length} documented in-bounds matches, ${snapshot.outsideCoverage.length} outside coverage, ${snapshot.unmatchedCount} unmatched. No building matches inferred.`,
);
