import { z } from "zod";
import { boundsOf, intersects } from "../../shared/geo";
import { floodAreaSchema, type FloodArea } from "../../shared/flood";
import type { Bounds, Position } from "../../shared/types";

const ring = z.array(z.tuple([z.number(), z.number()]));
const featureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    // Some published features leave these blank; keep that visible, never guess.
    origin: z
      .string()
      .nullable()
      .transform((v) => v || "Not stated"),
    flood_zone: z.enum(["FZ2", "FZ3"]),
    flood_source: z
      .string()
      .nullable()
      .transform((v) => v || "Not stated"),
  }),
  geometry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: z.array(ring) }),
    z.object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(z.array(ring)),
    }),
  ]),
});
export const pageSchema = z.object({
  type: z.literal("FeatureCollection"),
  timeStamp: z.iso.datetime(),
  numberMatched: z.number().int().nonnegative(),
  numberReturned: z.number().int().nonnegative(),
  features: z.array(featureSchema),
  links: z.array(z.object({ rel: z.string(), href: z.string() })),
});
export type Page = z.infer<typeof pageSchema>;

/** Metres per degree near the map centre; accurate to well under 1% across the box. */
const KY = 111_200,
  KX = 111_200 * Math.cos((51.45 * Math.PI) / 180);
function distanceToSegment(p: Position, a: Position, b: Position): number {
  const [px, py] = [p[0] * KX, p[1] * KY],
    [ax, ay] = [a[0] * KX, a[1] * KY],
    [bx, by] = [b[0] * KX, b[1] * KY];
  const dx = bx - ax,
    dy = by - ay;
  const t =
    dx || dy
      ? Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
        )
      : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Douglas–Peucker; every dropped vertex lies within `tolerance` metres of the kept line. */
export function simplifyRing(
  points: Position[],
  tolerance: number,
): Position[] {
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = 0,
      index = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distanceToSegment(points[i], points[s], points[e]);
      if (d > max) [max, index] = [d, i];
    }
    if (index > 0 && max > tolerance) {
      keep[index] = true;
      stack.push([s, index], [index, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
/** Sutherland–Hodgman against a rectangle; exact for rings, edges on the clip line are artefacts. */
export function clipRing(points: Position[], box: Bounds): Position[] {
  type Edge = (p: Position) => boolean;
  const edges: [Edge, (a: Position, b: Position) => Position][] = [
    [
      (p) => p[0] >= box[0],
      (a, b) => [
        box[0],
        a[1] + ((b[1] - a[1]) * (box[0] - a[0])) / (b[0] - a[0]),
      ],
    ],
    [
      (p) => p[0] <= box[2],
      (a, b) => [
        box[2],
        a[1] + ((b[1] - a[1]) * (box[2] - a[0])) / (b[0] - a[0]),
      ],
    ],
    [
      (p) => p[1] >= box[1],
      (a, b) => [
        a[0] + ((b[0] - a[0]) * (box[1] - a[1])) / (b[1] - a[1]),
        box[1],
      ],
    ],
    [
      (p) => p[1] <= box[3],
      (a, b) => [
        a[0] + ((b[0] - a[0]) * (box[3] - a[1])) / (b[1] - a[1]),
        box[3],
      ],
    ],
  ];
  let ring = points.slice(0, -1);
  for (const [inside, cross] of edges) {
    const next: Position[] = [];
    ring.forEach((current, i) => {
      const previous = ring[(i + ring.length - 1) % ring.length];
      if (inside(current)) {
        if (!inside(previous)) next.push(cross(previous, current));
        next.push(current);
      } else if (inside(previous)) next.push(cross(previous, current));
    });
    ring = next;
    if (!ring.length) return [];
  }
  return ring.length ? [...ring, ring[0]] : [];
}
const round = (n: number) => Math.round(n * 1e5) / 1e5;
export const prepareRing = (
  raw: [number, number][],
  tolerance: number,
  box: Bounds,
): Position[] | undefined => {
  const closed =
    raw[0][0] === raw.at(-1)![0] && raw[0][1] === raw.at(-1)![1]
      ? raw
      : [...raw, raw[0]];
  const clipped = clipRing(closed as Position[], box);
  if (clipped.length < 4) return undefined;
  const out = simplifyRing(clipped, tolerance).map(
    ([x, y]) => [round(x), round(y)] as Position,
  );
  return out.length >= 4 ? out : undefined;
};

export const CLIP_MARGIN = 0.005;
export function buildFlood(pages: Page[], bounds: Bounds, tolerance: number) {
  const box: Bounds = [
    bounds[0] - CLIP_MARGIN,
    bounds[1] - CLIP_MARGIN,
    bounds[2] + CLIP_MARGIN,
    bounds[3] + CLIP_MARGIN,
  ];
  const groups = new Map<string, FloodArea>();
  const seen = new Set<string>();
  let sourceVertices = 0,
    publishedVertices = 0,
    sourceFeatures = 0,
    zone2 = 0,
    zone3 = 0;
  for (const page of pages)
    for (const feature of page.features) {
      const key =
        JSON.stringify(feature.geometry) +
        feature.properties.flood_zone +
        feature.properties.flood_source;
      if (seen.has(key))
        throw new Error("Duplicate flood feature across pages");
      seen.add(key);
      sourceFeatures++;
      if (feature.properties.flood_zone === "FZ2") zone2++;
      else zone3++;
      const polygons =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      const kept: Position[][][] = [];
      for (const rings of polygons) {
        sourceVertices += rings.reduce((n, r) => n + r.length, 0);
        const prepared = rings.map((r) => prepareRing(r, tolerance, box));
        // A collapsed outer ring removes the polygon; a collapsed hole is simply filled.
        if (!prepared[0]) continue;
        if (!intersects(boundsOf(prepared[0]), bounds)) continue;
        const done = prepared.filter((r): r is Position[] => !!r);
        publishedVertices += done.reduce((n, r) => n + r.length, 0);
        kept.push(done);
      }
      if (!kept.length) continue;
      const {
        flood_zone: zone,
        flood_source: source,
        origin,
      } = feature.properties;
      const id = `${zone}|${source}|${origin}`;
      const group = groups.get(id) ?? { zone, source, origin, polygons: [] };
      group.polygons.push(...kept);
      groups.set(id, group);
    }
  const areas = [...groups.values()]
    .map((a) => floodAreaSchema.parse(a))
    // Zone 2 first so Zone 3 draws on top.
    .sort(
      (a, b) =>
        a.zone.localeCompare(b.zone) ||
        a.source.localeCompare(b.source) ||
        a.origin.localeCompare(b.origin),
    );
  return {
    areas,
    counts: { sourceFeatures, zone2Features: zone2, zone3Features: zone3 },
    processing: { sourceVertices, publishedVertices },
  };
}
