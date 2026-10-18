/**
 * Builds public/data/flood-zones.v1.json from the Environment Agency Flood Map
 * for Planning – Flood Zones OGC API (England, OGL). Node 24.
 *   npm run data:flood             download pages (or reuse the cache)
 *   npm run data:flood -- --offline
 * Raw pages and a manifest stay under ignored raw/flood/.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { REGION } from "../../shared/config";
import {
  EA_DATASET_URL,
  EA_ITEMS_URL,
  OGL_URL,
  floodSchema,
} from "../../shared/flood";
import { CLIP_MARGIN, buildFlood, pageSchema, type Page } from "./build";

const offline = process.argv.includes("--offline");
const output = process.env.FLOOD_OUTPUT ?? "public/data/flood-zones.v1.json";
const TOLERANCE_METRES = 4;
// CKAN revision date of the dataset when reviewed (2026-05-20).
const DATASET_REVISION = "2026-05-20";
const sha = (data: string) => createHash("sha256").update(data).digest("hex");
const first = `${EA_ITEMS_URL}?${new URLSearchParams({
  f: "application/geo+json",
  bbox: REGION.bounds.join(","),
  limit: "1000",
})}`;
function allowed(url: string): string {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "environment.data.gov.uk" ||
    !u.pathname.startsWith(new URL(EA_ITEMS_URL).pathname)
  )
    throw new Error(`Unexpected page URL: ${url}`);
  return u.href;
}
await mkdir("raw/flood", { recursive: true });
const manifestPath = "raw/flood/manifest.json";
type Manifest = {
  retrievedOn: string;
  pages: { url: string; sha256: string; file: string }[];
};
let manifest: Manifest | undefined;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const pages: { page: Page; url: string; sha256: string }[] = [];
if (manifest) {
  for (const entry of manifest.pages) {
    const text = await readFile(entry.file, "utf8");
    if (sha(text) !== entry.sha256)
      throw new Error(`Cached ${entry.file} disagrees with the manifest`);
    pages.push({
      page: pageSchema.parse(JSON.parse(text)),
      url: entry.url,
      sha256: entry.sha256,
    });
  }
} else {
  if (offline) throw new Error("Offline: raw/flood/manifest.json is missing");
  let url: string | undefined = allowed(first);
  const entries: Manifest["pages"] = [];
  while (url) {
    const response = await fetch(url, {
      redirect: "error",
      headers: { accept: "application/geo+json" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`EA HTTP ${response.status}: ${url}`);
    const text = await response.text();
    const page = pageSchema.parse(JSON.parse(text));
    const file = `raw/flood/page-${pages.length + 1}.json`;
    await writeFile(file, text);
    entries.push({ url, sha256: sha(text), file });
    pages.push({ page, url, sha256: sha(text) });
    const next = page.links.find((l) => l.rel === "next")?.href;
    url = next ? allowed(next) : undefined;
    if (pages.length > 50) throw new Error("Too many pages");
  }
  manifest = {
    retrievedOn: new Date().toISOString().slice(0, 10),
    pages: entries,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}
const matched = pages[0].page.numberMatched;
const returned = pages.reduce((n, p) => n + p.page.features.length, 0);
if (returned !== matched)
  throw new Error(`Incomplete download: ${returned} of ${matched} features`);
const built = buildFlood(
  pages.map((p) => p.page),
  REGION.bounds,
  TOLERANCE_METRES,
);
const asset = floodSchema.parse({
  version: 1,
  source: {
    name: "Flood Map for Planning – Flood Zones (Environment Agency)",
    datasetUrl: EA_DATASET_URL,
    itemsUrl: EA_ITEMS_URL,
    datasetRevision: DATASET_REVISION,
    serviceTimestamp: pages[0].page.timeStamp,
    retrievedOn: manifest!.retrievedOn,
    pages: pages.map((p) => ({
      url: p.url,
      sha256: p.sha256,
      features: p.page.features.length,
    })),
    licence: "Open Government Licence",
    licenceUrl: OGL_URL,
    attribution:
      "© Environment Agency copyright and/or database right 2025. All rights reserved. Licensed under the Open Government Licence",
  },
  scenario:
    "Present-day Flood Zone 2 and 3 for rivers and the sea, ignoring the benefits of flood defences. Flood Zone 1 is every area not shown.",
  selection: `Features whose published polygon intersects [${REGION.bounds.join(", ")}], clipped to that box plus a ${CLIP_MARGIN}° margin.`,
  processing: {
    coordinates:
      "WGS84 longitude/latitude as served (CRS84), rounded to 5 decimal places (about 1 m)",
    simplification: `Clipped as above, then Douglas–Peucker, every removed vertex within ${TOLERANCE_METRES} m of the kept line; features grouped by zone, source and origin`,
    ...built.processing,
  },
  counts: built.counts,
  areas: built.areas,
});
await writeFile(output, JSON.stringify(asset) + "\n");
console.log(
  `${built.counts.sourceFeatures} features (${built.counts.zone2Features} FZ2, ${built.counts.zone3Features} FZ3), ${built.processing.sourceVertices} → ${built.processing.publishedVertices} vertices → ${output}`,
);
