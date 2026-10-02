/** Import only the pinned ODbL database; no reference application code. Node 24 + curl. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { REGION } from "../../shared/config";
import { boundsOf, centre, inBounds } from "../../shared/geo";
import {
  buildingSchema,
  type Building,
  type Geography,
  type Place,
  type SearchBuilding,
  type BuildingChunk,
} from "../../shared/types";
import { createDemo } from "../../src/property/data";

const revision = "475453a10c674ece44f566120ec43e4491cddf32";
const base = `https://raw.githubusercontent.com/Zagitalc/mini-reading-3d/${revision}/public/data/`;
const hashes: Record<string, string> = {};
const output = process.env.GEOGRAPHY_OUTPUT ?? "public/data";
let expected: Record<string, string> = {};
try {
  const previous = JSON.parse(
    await readFile("public/data/provenance.json", "utf8"),
  );
  if (previous.revision === revision) expected = previous.inputs;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
await mkdir("raw/geography", { recursive: true });
await mkdir(output, { recursive: true });
const exec = promisify(execFile);
async function download(path: string): Promise<Buffer> {
  const local = `raw/geography/${revision}-${path.replaceAll("/", "_")}`;
  let data: Buffer;
  try {
    data = await readFile(local);
  } catch {
    const result = await exec(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--retry",
        "2",
        "--max-time",
        "60",
        base + path,
      ],
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 },
    );
    data = result.stdout;
    await writeFile(local, data);
  }
  hashes[path] = createHash("sha256").update(data).digest("hex");
  if (expected[path] && hashes[path] !== expected[path])
    throw new Error(`Source checksum mismatch: ${path}`);
  return data;
}
async function parallel<T>(
  items: T[],
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await work(item);
      }
    }),
  );
}
const upstream = JSON.parse((await download("manifest.json")).toString());
if (JSON.stringify(upstream.bounds) !== JSON.stringify(REGION.bounds))
  throw new Error(
    "Source coverage differs from region; implement clipping before changing it",
  );
const buildings: Building[] = [];
const groups = new Map<string, Building[]>();
await parallel(
  upstream.chunks as { id: string; url: string }[],
  async (chunk) => {
    const values = JSON.parse(
      (await download(chunk.url.replace("/data/", ""))).toString(),
    ) as unknown[];
    const parsed = values
      .map((row) => buildingSchema.parse(row))
      .filter((b) => inBounds(centre(b.rings), REGION.bounds));
    groups.set(chunk.id, parsed);
    buildings.push(...parsed);
  },
);
console.log(
  `Validated ${buildings.length} footprints; downloading local vector tiles…`,
);
const tileX = (lon: number, z: number) =>
  Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) =>
  Math.floor(
    ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z,
  );
const tiles: { path: string; x: number; y: number; z: number }[] = [];
for (let z = 10; z <= 15; z++)
  for (
    let x = tileX(REGION.bounds[0], z);
    x <= tileX(REGION.bounds[2], z);
    x++
  ) {
    for (
      let y = tileY(REGION.bounds[3], z);
      y <= tileY(REGION.bounds[1], z);
      y++
    )
      tiles.push({ path: `tiles/${z}/${x}/${y}.pbf`, x, y, z });
  }
const addresses = new Map<string, string>();
await parallel(tiles, async (tile) => {
  const data = await download(tile.path);
  // Self-host tile bytes. No reference stylesheet, labels or application code is reused.
  const dest = `${output}/v2/${tile.path}`;
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, data);
  if (tile.z !== 15 || !data.length) return;
  const layer = new VectorTile(new PbfReader(data)).layers.reading;
  if (!layer) return;
  for (let i = 0; i < layer.length; i++) {
    const p = layer.feature(i).properties;
    if (p.kind === "building" && p["addr:street"])
      addresses.set(
        String(p.id),
        [p["addr:housenumber"], p["addr:street"]].filter(Boolean).join(" "),
      );
  }
});
const lookup: Record<string, string> = {};
const search: SearchBuilding[] = [];
const chunks: BuildingChunk[] = [];
for (const [id, rows] of [...groups.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!rows.length) continue;
  rows.sort((a, b) => a.id.localeCompare(b.id));
  for (const b of rows) {
    if (lookup[b.id]) throw new Error(`Duplicate building ID: ${b.id}`);
    lookup[b.id] = id;
    b.address = addresses.get(b.id);
    if (b.name || b.address)
      search.push({
        id: b.id,
        name: b.name,
        address: b.address,
        kind: b.kind,
        position: centre(b.rings),
      });
  }
  const data = JSON.stringify(rows),
    url = `/data/v2/chunks/${id}.json`;
  await mkdir(`${output}/v2/chunks`, { recursive: true });
  await writeFile(`${output}/v2/chunks/${id}.json`, data);
  chunks.push({
    id,
    bounds: boundsOf(rows.flatMap((b) => b.rings[0])),
    count: rows.length,
    url,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
const rawPlaces: Place[] = JSON.parse(
  (await download("features.json")).toString(),
).places;
const places = rawPlaces.filter(
  (p) => p.id.startsWith("node/") && inBounds(p.position, REGION.bounds),
);
// One clearly labelled curated station navigation point, not a property identity.
places.unshift({
  id: "navigation:reading-station",
  name: "Reading station",
  kind: "station navigation point",
  position: REGION.origin,
});
const demo = createDemo(buildings);
const bootstrapIds = new Set(demo.locations.map((p) => p.buildingId));
const bootstrap = buildings.filter(
  (b) =>
    bootstrapIds.has(b.id) ||
    [
      "Reading Town Hall",
      "Reading Abbey",
      "Broad Street Mall",
      "The Hexagon",
    ].includes(b.name ?? ""),
);
const geography: Geography = {
  version: 2,
  bounds: REGION.bounds,
  provenance: {
    source: "OpenStreetMap contributors / Geofabrik",
    date: upstream.sourceTimestamp.slice(0, 10),
    license: "ODbL 1.0",
    url: "https://www.openstreetmap.org/copyright",
    quality: "mapped",
  },
  buildings: bootstrap.sort((a, b) => a.id.localeCompare(b.id)),
  places,
  buildingCount: buildings.length,
  chunks,
  tiles: "/data/v2/tiles/{z}/{x}/{y}.pbf",
  lookupUrl: "/data/v2/building-lookup.json",
  searchUrl: "/data/v2/search.json",
};
await writeFile(`${output}/geography.v2.json`, JSON.stringify(geography));
await writeFile(`${output}/v2/building-lookup.json`, JSON.stringify(lookup));
await writeFile(
  `${output}/v2/search.json`,
  JSON.stringify(search.sort((a, b) => a.id.localeCompare(b.id))),
);
await writeFile(
  `${output}/provenance.json`,
  JSON.stringify(
    {
      source: upstream.sourceUrl,
      sourceTimestamp: upstream.sourceTimestamp,
      redistribution: base,
      revision,
      bounds: REGION.bounds,
      license: "ODbL 1.0",
      buildings: buildings.length,
      chunks: chunks.length,
      tiles: tiles.length,
      searchEntries: search.length,
      excludedOutsideBounds: upstream.stats.buildings - buildings.length,
      note: "Pinned ODbL geography. Precise building chunks; self-hosted vector tiles. Heights retain upstream provenance; inferred roof tags discarded. Centroids outside bounds excluded from detail records.",
      inputs: Object.fromEntries(
        Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Imported ${buildings.length} buildings, ${chunks.length} chunks, ${tiles.length} tiles, ${search.length} search entries.`,
);
