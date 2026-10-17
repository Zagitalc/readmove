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
export const ONS_GEOGRAPHY_SERVICE =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5/FeatureServer/0";
export const NOMIS_API = "https://www.nomisweb.co.uk/api/v01/dataset/";
export const ONS_LICENCE_PAGE =
  "https://www.ons.gov.uk/methodology/geography/licences";

const sourceSchema = z.object({
  url: z.url().refine((url) => url.startsWith("https://")),
  sha256: hash,
  retrievedOn: z.iso.date(),
});
const statisticSchema = sourceSchema.extend({
  table: z.enum(["TS001", "TS006"]),
  dataset: z.enum(["NM_2021_1", "NM_2026_1"]),
  title: z.string().min(1),
  unit: z.string().min(1),
  /** Census reference day; every value describes the area, never a resident. */
  referenceDate: z.literal("2021-03-21"),
  denominator: z.string().min(1),
});

/** An official 2021 LSOA with Census 2021 values published by ONS for that exact code. */
export const lsoaSchema = z.object({
  code: z.string().regex(/^[EW]01\d{6}$/),
  name: z.string().min(1),
  /** Polygon list: outer ring first, then holes. */
  polygons: z.array(z.array(ringSchema).min(1)).min(1),
  usualResidents: z.number().int().positive(),
  /** Published TS006 value, not recomputed from generalised boundaries. */
  residentsPerKm2: z.number().finite().nonnegative(),
});
export type Lsoa = z.infer<typeof lsoaSchema>;

export const neighbourhoodsSchema = z
  .object({
    version: z.literal(1),
    geography: sourceSchema.extend({
      type: z.literal("LSOA"),
      edition: z.literal("December 2021"),
      product: z.literal("BGC V5"),
      resolution: z.string().min(1),
      itemModifiedOn: z.iso.date(),
    }),
    statistics: z.array(statisticSchema).length(2),
    license: z.literal("Open Government Licence v3.0"),
    licensePage: z.literal(ONS_LICENCE_PAGE),
    attribution: z.array(z.string().min(1)).min(2),
    /** LSOAs intersecting the map box; boundaries are not clipped to it. */
    selection: z.string().min(1),
    areas: z.array(lsoaSchema).min(1),
  })
  .superRefine((asset, ctx) => {
    const codes = new Set<string>();
    for (const area of asset.areas) {
      if (codes.has(area.code))
        ctx.addIssue({ code: "custom", message: `Duplicate ${area.code}` });
      codes.add(area.code);
    }
    const tables = asset.statistics.map((s) => s.table).sort();
    if (tables.join() !== "TS001,TS006")
      ctx.addIssue({ code: "custom", message: "Expected TS001 and TS006" });
  });
export type Neighbourhoods = z.infer<typeof neighbourhoodsSchema>;

/**
 * Generalised boundaries can share edges; the first area in code order wins.
 * Returns undefined rather than the nearest area when nothing contains the point.
 */
export function lsoaAt(position: Position, areas: Lsoa[]): Lsoa | undefined {
  return areas.find((area) =>
    area.polygons.some((rings) => pointInPolygon(position, rings)),
  );
}
