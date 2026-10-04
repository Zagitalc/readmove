import { z } from "zod";
import {
  lookupSourceSchema,
  transactionIdSchema,
  uprnSchema,
} from "./sale-locations";
import { positionSchema } from "./types";
import { inBounds } from "./geo";
import { REGION } from "./config";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const evidence = z
  .array(hash)
  .min(1)
  .refine((a) => new Set(a).size === a.length);
const mapping = z.object({ uprn: uprnSchema, sourceHashes: evidence });
export const verifiedLocationsSchema = z
  .object({
    version: z.literal(2),
    salesAssetSha256: hash,
    sources: z
      .array(
        lookupSourceSchema.extend({
          rows: z.number().int().positive(),
          bytes: z.number().int().positive(),
        }),
      )
      .min(1),
    identifiers: z.array(
      mapping.extend({ transactionId: transactionIdSchema }),
    ),
    ambiguous: z.array(
      z.object({
        transactionId: transactionIdSchema,
        mappings: z.array(mapping).min(2),
      }),
    ),
    coordinates: z.array(
      z.object({
        uprn: uprnSchema,
        position: positionSchema.refine(
          ([lon, lat]) => lon >= -9 && lon <= 3 && lat >= 49 && lat <= 61,
          "Expected a GB coordinate",
        ),
      }),
    ),
    coordinateSource: z.object({
      product: z.literal("OS Open UPRN"),
      url: z.url().refine((u) => u.startsWith("https://api.os.uk/")),
      sha256: hash,
      csvSha256: hash,
      member: z.string().min(1),
      releasePeriod: z.string().regex(/^\d{4}-\d{2}$/),
      snapshotDate: z.iso.date(),
      retrievedOn: z.iso.date(),
      rows: z.number().int().positive(),
      attribution: z.string().min(1),
      ambiguousUprns: z.array(uprnSchema),
    }),
    counts: z.object({
      residentialSales: z.number().int().nonnegative(),
      identifierMatches: z.number().int().nonnegative(),
      unmatchedIdentifiers: z.number().int().nonnegative(),
      ambiguousIdentifiers: z.number().int().nonnegative(),
      coordinateMatches: z.number().int().nonnegative(),
      outsideMapBounds: z.number().int().nonnegative(),
    }),
  })
  .superRefine((d, ctx) => {
    const hashes = new Set(d.sources.map((s) => s.sha256));
    const ids = [...d.identifiers, ...d.ambiguous].map((i) => i.transactionId);
    const uprns = new Set(d.identifiers.map((i) => i.uprn));
    const points = new Map(d.coordinates.map((c) => [c.uprn, c.position]));
    const located = d.identifiers.filter((i) => points.has(i.uprn));
    const allMappings = [
      ...d.identifiers,
      ...d.ambiguous.flatMap((a) => a.mappings),
    ];
    if (
      hashes.size !== d.sources.length ||
      new Set(ids).size !== ids.length ||
      points.size !== d.coordinates.length ||
      d.coordinates.some(
        (c) =>
          !uprns.has(c.uprn) ||
          d.coordinateSource.ambiguousUprns.includes(c.uprn),
      ) ||
      allMappings.some((m) => m.sourceHashes.some((h) => !hashes.has(h))) ||
      d.ambiguous.some(
        (a) =>
          new Set(a.mappings.map((m) => m.uprn)).size !== a.mappings.length,
      ) ||
      d.counts.identifierMatches !== d.identifiers.length ||
      d.counts.ambiguousIdentifiers !== d.ambiguous.length ||
      d.counts.residentialSales !==
        ids.length + d.counts.unmatchedIdentifiers ||
      d.counts.coordinateMatches !== located.length ||
      d.counts.outsideMapBounds !==
        located.filter((i) => !inBounds(points.get(i.uprn), REGION.bounds))
          .length
    )
      ctx.addIssue({
        code: "custom",
        message: "Identifiers, provenance, coordinates or coverage disagree",
      });
  });
export type VerifiedLocations = z.infer<typeof verifiedLocationsSchema>;
