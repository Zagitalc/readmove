import { z } from "zod";
import { positionSchema, provenanceSchema, transactionSchema } from "./types";

export const landRegistryRecordSchema = transactionSchema
  .omit({ propertyRef: true })
  .extend({
    address: z.object({
      postcode: z.string(),
      paon: z.string(),
      saon: z.string(),
      street: z.string(),
      locality: z.string(),
      town: z.string(),
      district: z.string(),
      county: z.string(),
    }),
    newBuild: z.boolean(),
    category: z.enum(["A", "B"]),
  });
export type LandRegistryRecord = z.infer<typeof landRegistryRecordSchema>;
export const saleMatchSchema = z
  .object({
    transactionId: z.string().min(1),
    propertyRef: z.string().min(1),
    uprn: z
      .string()
      .regex(/^\d{1,12}$/)
      .optional(),
    position: positionSchema,
    method: z.enum(["official-uprn-lookup", "reviewed-address-match"]),
    evidenceUrl: z
      .url()
      .refine(
        (url) => url.startsWith("https://"),
        "Matching evidence must use HTTPS",
      ),
    matchedOn: z.iso.date(),
  })
  .refine(
    (match) => match.method !== "official-uprn-lookup" || !!match.uprn,
    "An official UPRN lookup must supply its UPRN",
  );
export type SaleMatch = z.infer<typeof saleMatchSchema>;
export const importAuditSchema = z.object({
  rows: z.number().int().nonnegative(),
  actions: z.object({
    A: z.number().int().nonnegative(),
    C: z.number().int().nonnegative(),
    D: z.number().int().nonnegative(),
  }),
  candidateRows: z.number().int().nonnegative(),
  missingPostcodeRows: z.number().int().nonnegative(),
  otherPostcodeRows: z.number().int().nonnegative(),
  removedExistingRecords: z.number().int().nonnegative(),
});
export type ImportAudit = z.infer<typeof importAuditSchema>;
export const salesSnapshotSchema = z.object({
  importAudit: importAuditSchema.optional(),
  version: z.literal(1),
  sourceDate: z.iso.date(),
  candidateOutcodes: z.array(z.string()),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  provenance: provenanceSchema,
  appliedFiles: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  records: z.array(landRegistryRecordSchema),
  matches: z.array(saleMatchSchema),
  outsideCoverage: z.array(saleMatchSchema),
  unmatchedCount: z.number().int().nonnegative(),
});
export type SalesSnapshot = z.infer<typeof salesSnapshotSchema>;
