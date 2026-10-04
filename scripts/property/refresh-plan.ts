import { z } from "zod";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const local = { localFile: z.string().min(1).optional() };
export const refreshPlanSchema = z
  .object({
    version: z.literal(1),
    sales: z.object({ path: z.string(), sha256: hash }),
    baseline: z.string(),
    lookups: z
      .array(verifiedLocationsSchema.shape.sources.element.extend(local))
      .min(1),
    coordinates: verifiedLocationsSchema.shape.coordinateSource
      .omit({ ambiguousUprns: true })
      .extend({
        ...local,
        bytes: z.number().int().positive(),
        lastModified: z.string().min(1),
      }),
  })
  .superRefine((p, ctx) => {
    if (
      new Set(p.lookups.map((s) => s.sha256)).size !== p.lookups.length ||
      new Set(p.lookups.map((s) => s.period)).size !== p.lookups.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate lookup release/hash",
      });
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    for (const s of p.lookups) {
      const [year, month] = s.period.split("-");
      if (
        !months[Number(month) - 1] ||
        !s.url.endsWith(
          `pp-uprn-lookup-${months[Number(month) - 1]}-${year}.csv`,
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Lookup period and URL disagree",
        });
    }
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.coordinates.releasePeriod) ||
      p.coordinates.snapshotDate.slice(0, 7) > p.coordinates.releasePeriod ||
      p.coordinates.retrievedOn < p.coordinates.snapshotDate
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid coordinate release/snapshot chronology",
      });
  });
export type RefreshPlan = z.infer<typeof refreshPlanSchema>;
