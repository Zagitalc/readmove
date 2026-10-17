import { parse } from "csv-parse/sync";
import { z } from "zod";
import { intersects, boundsOf } from "../../shared/geo";
import {
  neighbourhoodsSchema,
  type Lsoa,
  type Neighbourhoods,
} from "../../shared/neighbourhoods";
import type { Bounds, Position } from "../../shared/types";

const featureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    LSOA21CD: z.string(),
    LSOA21NM: z.string(),
  }),
  geometry: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    }),
    z.object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
    }),
  ]),
});
const collectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(featureSchema),
  exceededTransferLimit: z.boolean().optional(),
});
const rowSchema = z.object({
  DATE: z.literal("2021"),
  GEOGRAPHY_CODE: z.string(),
  GEOGRAPHY_NAME: z.string(),
  // Blank must stay unavailable; z.coerce would silently turn it into 0.
  OBS_VALUE: z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .transform(Number),
  OBS_STATUS: z.literal("A"),
});

/** ~1 m at Reading's latitude; well inside the 20 m generalisation. */
const round = (value: number) => Math.round(value * 1e5) / 1e5;
export function normaliseRing(ring: [number, number][]): Position[] {
  const out: Position[] = [];
  for (const [x, y] of ring) {
    const point: Position = [round(x), round(y)];
    const last = out.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  const first = out[0];
  const last = out.at(-1)!;
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([...first]);
  if (out.length < 4) throw new Error("Ring collapsed after rounding");
  return out;
}

/** Approximate area in km² using a local equirectangular projection. */
export function areaKm2(polygons: Position[][][]): number {
  const signed = (ring: Position[]) => {
    const lat = (ring[0][1] * Math.PI) / 180;
    const kx = 111.32 * Math.cos(lat),
      ky = 110.574;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++)
      sum +=
        ring[i][0] * kx * ring[i + 1][1] * ky -
        ring[i + 1][0] * kx * ring[i][1] * ky;
    return Math.abs(sum) / 2;
  };
  return polygons.reduce(
    (total, [outer, ...holes]) =>
      total + signed(outer) - holes.reduce((h, r) => h + signed(r), 0),
    0,
  );
}

export function parseNomis(
  csv: string,
  label: string,
): Map<string, { name: string; value: number }> {
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  const values = new Map<string, { name: string; value: number }>();
  for (const raw of rows) {
    const row = rowSchema.parse(raw);
    if (values.has(row.GEOGRAPHY_CODE))
      throw new Error(`${label}: duplicate ${row.GEOGRAPHY_CODE}`);
    values.set(row.GEOGRAPHY_CODE, {
      name: row.GEOGRAPHY_NAME,
      value: row.OBS_VALUE,
    });
  }
  return values;
}

export function boundaryFeatures(geojson: unknown, bounds: Bounds) {
  const collection = collectionSchema.parse(geojson);
  if (collection.exceededTransferLimit)
    throw new Error("Boundary query was truncated; page the request");
  return collection.features
    .map((feature) => ({
      code: feature.properties.LSOA21CD,
      name: feature.properties.LSOA21NM,
      polygons: (feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
      ).map((rings) => rings.map(normaliseRing)),
    }))
    .filter((area) =>
      area.polygons.some((rings) => intersects(boundsOf(rings[0]), bounds)),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

export interface BuildInput {
  geojson: unknown;
  residentsCsv: string;
  densityCsv: string;
  bounds: Bounds;
  meta: Omit<Neighbourhoods, "areas" | "version" | "selection">;
}
export function buildNeighbourhoods(input: BuildInput) {
  const features = boundaryFeatures(input.geojson, input.bounds);
  const residents = parseNomis(input.residentsCsv, "TS001");
  const density = parseNomis(input.densityCsv, "TS006");
  const areas: Lsoa[] = [];
  const densityChecks: { code: string; ratio: number }[] = [];
  for (const feature of features) {
    const r = residents.get(feature.code),
      d = density.get(feature.code);
    // An unavailable statistic is never written as zero.
    if (!r || !d) throw new Error(`Census values missing for ${feature.code}`);
    if (r.name !== feature.name || d.name !== feature.name)
      throw new Error(`Name disagreement for ${feature.code}`);
    areas.push({
      ...feature,
      usualResidents: r.value,
      residentsPerKm2: d.value,
    });
    densityChecks.push({
      code: feature.code,
      ratio: r.value / areaKm2(feature.polygons) / Math.max(d.value, 1e-9),
    });
  }
  const extra = [...residents.keys()].filter(
    (code) => !features.some((f) => f.code === code),
  );
  if (extra.length)
    throw new Error(`Unexpected Census codes: ${extra.join(", ")}`);
  const asset = neighbourhoodsSchema.parse({
    version: 1,
    ...input.meta,
    selection: `2021 LSOAs whose generalised boundary intersects [${input.bounds.join(", ")}]; boundaries are not clipped.`,
    areas,
  });
  const ratios = densityChecks.map((c) => c.ratio).sort((a, b) => a - b);
  return {
    asset,
    audit: {
      areas: areas.length,
      usualResidents: areas.reduce((sum, a) => sum + a.usualResidents, 0),
      coordinates: areas.reduce(
        (sum, a) => sum + a.polygons.flat().reduce((n, r) => n + r.length, 0),
        0,
      ),
      // Generalised-boundary density ÷ published density; land-area and
      // generalisation differences make this a join sanity check only.
      densityRatio: {
        min: ratios[0],
        median: ratios[Math.floor(ratios.length / 2)],
        max: ratios.at(-1),
        outliers: densityChecks.filter((c) => c.ratio < 0.6 || c.ratio > 1.6),
      },
    },
  };
}
