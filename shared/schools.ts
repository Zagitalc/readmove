import { z } from "zod";
import { positionSchema } from "./types";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const GIAS_DOWNLOADS =
  "https://get-information-schools.service.gov.uk/Downloads";
export const GIAS_RECORD =
  "https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/";
export const OGL_URL =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

export const schoolSchema = z.object({
  urn: z.string().regex(/^[1-9]\d{5}$/),
  name: z.string().min(1),
  /** Official GIAS labels, kept verbatim rather than collapsed into our own categories. */
  type: z.string().min(1),
  phase: z.string().min(1),
  status: z.enum(["Open", "Open, but proposed to close"]),
  /** Statutory age range; absent when the establishment does not publish one. */
  ageRange: z
    .tuple([z.number().int().min(0), z.number().int().max(25)])
    .optional(),
  authority: z.string().min(1),
  postcode: z.string().optional(),
  website: z
    .url()
    .refine((url) => /^https?:\/\//.test(url))
    .optional(),
  position: positionSchema,
});
export type School = z.infer<typeof schoolSchema>;

export const schoolsSchema = z
  .object({
    version: z.literal(1),
    source: z.object({
      name: z.literal("Get Information about Schools (DfE)"),
      url: z
        .url()
        .regex(
          /^https:\/\/ea-edubase-api-prod\.azurewebsites\.net\/edubase\/downloads\/public\/edubasealldata\d{8}\.csv$/,
        ),
      extractDate: z.iso.date(),
      retrievedOn: z.iso.date(),
      sha256: hash,
      bytes: z.number().int().positive(),
      downloadsPage: z.literal(GIAS_DOWNLOADS),
      licence: z.literal("Open Government Licence v3.0"),
      licenceUrl: z.literal(OGL_URL),
      attribution: z.string().min(1),
    }),
    coordinates: z.object({
      sourceCrs: z.literal("EPSG:27700 (British National Grid)"),
      method: z.string().min(1),
      approximateAccuracyMetres: z.number().positive(),
    }),
    selection: z.string().min(1),
    counts: z.object({
      sourceRows: z.number().int().positive(),
      inBoundsOpen: z.number().int().nonnegative(),
      closedInBounds: z.number().int().nonnegative(),
      missingCoordinates: z.number().int().nonnegative(),
    }),
    schools: z.array(schoolSchema),
  })
  .superRefine((data, ctx) => {
    const urns = new Set(data.schools.map((s) => s.urn));
    if (urns.size !== data.schools.length)
      ctx.addIssue({ code: "custom", message: "Duplicate URN" });
    if (data.schools.length !== data.counts.inBoundsOpen)
      ctx.addIssue({ code: "custom", message: "School count disagrees" });
  });
export type Schools = z.infer<typeof schoolsSchema>;
