import { z } from "zod";
import { pointInPolygon } from "./geo";
import { positionSchema, type Position } from "./types";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ringSchema = z
  .array(positionSchema)
  .min(4)
  .refine(
    (ring) => ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1],
    "Polygon rings must be closed",
  );
export const EA_DATASET_URL =
  "https://environment.data.gov.uk/explore/04532375-a198-476e-985e-0579a0a11b47";
export const EA_ITEMS_URL =
  "https://environment.data.gov.uk/geoservices/datasets/04532375-a198-476e-985e-0579a0a11b47/ogc/features/v1/collections/Flood_Zones_2_3_Rivers_and_Sea/items";
export const CHECK_FLOOD_RISK_URL =
  "https://check-long-term-flood-risk.service.gov.uk/";
export const OGL_URL =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

export const zoneSchema = z.enum(["FZ2", "FZ3"]);
export type FloodZone = z.infer<typeof zoneSchema>;
/** Official Flood Zone polygons for one zone and flood source, as published. */
export const floodAreaSchema = z.object({
  zone: zoneSchema,
  source: z.string().min(1),
  origin: z.string().min(1),
  polygons: z.array(z.array(ringSchema).min(1)).min(1),
});
export type FloodArea = z.infer<typeof floodAreaSchema>;

export const floodSchema = z.object({
  version: z.literal(1),
  source: z.object({
    name: z.literal(
      "Flood Map for Planning – Flood Zones (Environment Agency)",
    ),
    datasetUrl: z.literal(EA_DATASET_URL),
    itemsUrl: z.literal(EA_ITEMS_URL),
    datasetRevision: z.iso.date(),
    serviceTimestamp: z.iso.datetime(),
    retrievedOn: z.iso.date(),
    pages: z
      .array(
        z.object({ url: z.url(), sha256: hash, features: z.number().int() }),
      )
      .min(1),
    licence: z.literal("Open Government Licence"),
    licenceUrl: z.literal(OGL_URL),
    attribution: z.string().min(1),
  }),
  scenario: z.string().min(1),
  selection: z.string().min(1),
  processing: z.object({
    coordinates: z.string().min(1),
    simplification: z.string().min(1),
    sourceVertices: z.number().int().positive(),
    publishedVertices: z.number().int().positive(),
  }),
  counts: z.object({
    sourceFeatures: z.number().int().positive(),
    zone2Features: z.number().int().nonnegative(),
    zone3Features: z.number().int().nonnegative(),
  }),
  areas: z.array(floodAreaSchema).min(1),
});
export type Flood = z.infer<typeof floodSchema>;

export interface FloodHit {
  zone: FloodZone;
  source: string;
  origin: string;
}
/** Highest zone whose published polygon contains the point; Zone 3 outranks Zone 2. */
export function floodZoneAt(
  position: Position,
  areas: FloodArea[],
): FloodHit | undefined {
  let found: FloodHit | undefined;
  for (const area of areas)
    if (area.polygons.some((rings) => pointInPolygon(position, rings))) {
      const hit = { zone: area.zone, source: area.source, origin: area.origin };
      if (area.zone === "FZ3") return hit;
      found ??= hit;
    }
  return found;
}
/** Centre and outline are reported separately so an edge touch is never hidden or overstated. */
export function footprintFlood(
  centre: Position,
  outline: Position[],
  areas: FloodArea[],
): { centre?: FloodHit; outline?: FloodHit } {
  const rank = (hit?: FloodHit) => (hit ? (hit.zone === "FZ3" ? 2 : 1) : 0);
  let best: FloodHit | undefined;
  for (const point of outline) {
    const hit = floodZoneAt(point, areas);
    if (rank(hit) > rank(best)) best = hit;
    if (rank(best) === 2) break;
  }
  return { centre: floodZoneAt(centre, areas), outline: best };
}
