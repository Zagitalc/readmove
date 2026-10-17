/**
 * Builds the bounded ONS 2021 LSOA + Census 2021 asset. Node 24.
 *   npm run data:neighbourhoods            reuse cached sources, else download
 *   npm run data:neighbourhoods -- --offline
 * Raw responses and their receipts stay under ignored raw/neighbourhood/.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { REGION } from "../../shared/config";
import {
  NOMIS_API,
  ONS_GEOGRAPHY_SERVICE,
  ONS_LICENCE_PAGE,
  neighbourhoodsSchema,
} from "../../shared/neighbourhoods";
import { boundaryFeatures, buildNeighbourhoods } from "./build";

const offline = process.argv.includes("--offline");
const output =
  process.env.NEIGHBOURHOOD_OUTPUT ?? "public/data/neighbourhoods.v1.json";
const cache = "raw/neighbourhood";
const allowedHosts = new Set(["services1.arcgis.com", "www.nomisweb.co.uk"]);
// ArcGIS item 68515293204e43ca8ab56fa13ae8a547, last modified 11 August 2025.
const ITEM_MODIFIED_ON = "2025-08-11";

await mkdir(cache, { recursive: true });
const sha256 = (data: string) =>
  createHash("sha256").update(data).digest("hex");

let published: ReturnType<typeof neighbourhoodsSchema.parse> | undefined;
try {
  published = neighbourhoodsSchema.parse(
    JSON.parse(await readFile("public/data/neighbourhoods.v1.json", "utf8")),
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

async function source(name: string, url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname))
    throw new Error(`Unsupported source host: ${parsed.hostname}`);
  const file = `${cache}/${name}`;
  try {
    const receipt = JSON.parse(await readFile(file + ".json", "utf8"));
    const data = await readFile(file, "utf8");
    if (receipt.url !== url || receipt.sha256 !== sha256(data))
      throw new Error(`Cached ${name} disagrees with its receipt`);
    return {
      data,
      url,
      sha256: receipt.sha256,
      retrievedOn: receipt.retrievedOn,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (offline) throw new Error(`Offline source missing: ${file}`);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}`);
  const data = await response.text();
  const receipt = {
    url,
    sha256: sha256(data),
    retrievedOn: new Date().toISOString().slice(0, 10),
  };
  await writeFile(file, data);
  await writeFile(file + ".json", JSON.stringify(receipt, null, 2) + "\n");
  return { data, ...receipt };
}

const query = new URLSearchParams({
  where: "1=1",
  geometry: REGION.bounds.join(","),
  geometryType: "esriGeometryEnvelope",
  inSR: "4326",
  spatialRel: "esriSpatialRelIntersects",
  outFields: "LSOA21CD,LSOA21NM",
  outSR: "4326",
  geometryPrecision: "6",
  orderByFields: "LSOA21CD",
  f: "geojson",
});
const boundaries = await source(
  "lsoa-2021-bgc-v5.geojson",
  `${ONS_GEOGRAPHY_SERVICE}/query?${query}`,
);
const codes = boundaryFeatures(JSON.parse(boundaries.data), REGION.bounds).map(
  (area) => area.code,
);
const nomis = (dataset: string, extra: string) =>
  `${NOMIS_API}${dataset}.data.csv?geography=${codes.join(",")}&${extra}measures=20100&select=DATE,GEOGRAPHY_CODE,GEOGRAPHY_NAME,OBS_VALUE,OBS_STATUS`;
const residents = await source(
  "census-2021-ts001.csv",
  nomis("NM_2021_1", "c2021_restype_3=0&"),
);
const density = await source(
  "census-2021-ts006.csv",
  nomis("NM_2026_1", "cell=0&"),
);
if (published) {
  const previous = [published.geography, ...published.statistics];
  for (const current of [boundaries, residents, density]) {
    const match = previous.find((p) => p.url === current.url);
    if (match && match.sha256 !== current.sha256)
      console.warn(
        `Source changed since publication: ${current.url}\nReview before replacing ${output}.`,
      );
  }
}
const record = ({ url, sha256, retrievedOn }: typeof boundaries) => ({
  url,
  sha256,
  retrievedOn,
});
const { asset, audit } = buildNeighbourhoods({
  geojson: JSON.parse(boundaries.data),
  residentsCsv: residents.data,
  densityCsv: density.data,
  bounds: REGION.bounds,
  meta: {
    geography: {
      ...record(boundaries),
      type: "LSOA",
      edition: "December 2021",
      product: "BGC V5",
      resolution:
        "Generalised (20 m), clipped to the coastline; coordinates rounded to 5 decimal places",
      itemModifiedOn: ITEM_MODIFIED_ON,
    },
    statistics: [
      {
        ...record(residents),
        table: "TS001",
        dataset: "NM_2021_1",
        title: "Number of usual residents",
        unit: "usual residents",
        referenceDate: "2021-03-21",
        denominator:
          "All usual residents, in households and communal establishments, on Census Day",
      },
      {
        ...record(density),
        table: "TS006",
        dataset: "NM_2026_1",
        title: "Population density",
        unit: "usual residents per km²",
        referenceDate: "2021-03-21",
        denominator:
          "All usual residents divided by the area's land area in km², as published by ONS",
      },
    ],
    license: "Open Government Licence v3.0",
    licensePage: ONS_LICENCE_PAGE,
    attribution: [
      "Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
      "Contains OS data © Crown copyright and database right 2025",
    ],
  },
});
await writeFile(output, JSON.stringify(asset) + "\n");
await writeFile(
  `${cache}/audit.json`,
  JSON.stringify(
    { output, outputSha256: sha256(JSON.stringify(asset) + "\n"), ...audit },
    null,
    2,
  ) + "\n",
);
console.log(
  `${audit.areas} LSOAs, ${audit.usualResidents.toLocaleString("en-GB")} usual residents, ${audit.coordinates} coordinates → ${output}`,
);
console.log(
  `Density sanity ratio min ${audit.densityRatio.min?.toFixed(2)} · median ${audit.densityRatio.median?.toFixed(2)} · max ${audit.densityRatio.max?.toFixed(2)}; ${audit.densityRatio.outliers.length} outliers (see ${cache}/audit.json)`,
);
