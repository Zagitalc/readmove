import { z } from "zod";
import { REGION } from "./config";
import { inBounds } from "./geo";
import { positionSchema } from "./types";

export const transactionIdSchema = z
  .string()
  .regex(/^\{[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}\}$/);
export const uprnSchema = z.string().regex(/^[1-9][0-9]{0,11}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const lookupSourceSchema = z.object({
  url: z
    .url()
    .refine((url) =>
      /^https:\/\/price-paid-data\.publicdata\.landregistry\.gov\.uk\/pp-uprn-lookup-[a-z]{3}-\d{4}\.csv$/.test(
        url,
      ),
    ),
  sha256: hash,
  retrievedOn: z.iso.date(),
  lastModified: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  attribution: z.array(z.string().min(1)).min(2),
});
export const saleLocationsSchema = z
  .object({
    version: z.literal(1),
    salesAssetSha256: hash,
    source: lookupSourceSchema,
    counts: z.object({
      sourceRows: z.number().int().nonnegative(),
      residentialSales: z.number().int().nonnegative(),
      identifierMatches: z.number().int().nonnegative(),
      unmatchedIdentifiers: z.number().int().nonnegative(),
      ambiguousIdentifiers: z.number().int().nonnegative(),
      coordinateMatches: z.number().int().nonnegative(),
      outsideMapBounds: z.number().int().nonnegative(),
    }),
    identifiers: z.array(
      z.object({ transactionId: transactionIdSchema, uprn: uprnSchema }),
    ),
    // A UPRN is an identifier, never a coordinate or an OSM building identity.
    coordinates: z.array(
      z.object({
        uprn: uprnSchema,
        position: positionSchema,
      }),
    ),
    coordinateSource: z
      .object({
        product: z.literal("OS Open UPRN"),
        url: z.url().refine((u) => u.startsWith("https://")),
        sha256: hash,
        snapshotDate: z.iso.date(),
        attribution: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const tx = new Set(data.identifiers.map((i) => i.transactionId));
    const uprns = new Set(data.identifiers.map((i) => i.uprn));
    const points = new Map(data.coordinates.map((p) => [p.uprn, p.position]));
    const located = data.identifiers.filter((i) => points.has(i.uprn));
    const outside = located.filter(
      (i) => !inBounds(points.get(i.uprn), REGION.bounds),
    );
    if (
      tx.size !== data.identifiers.length ||
      points.size !== data.coordinates.length ||
      data.coordinates.some((p) => !uprns.has(p.uprn)) ||
      (data.coordinates.length && !data.coordinateSource) ||
      data.counts.identifierMatches !== data.identifiers.length ||
      data.counts.residentialSales !==
        data.counts.identifierMatches +
          data.counts.unmatchedIdentifiers +
          data.counts.ambiguousIdentifiers ||
      data.counts.coordinateMatches !== located.length ||
      data.counts.outsideMapBounds !== outside.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Identity, coordinate evidence or coverage counts disagree",
      });
  });
export type SaleLocations = z.infer<typeof saleLocationsSchema>;
