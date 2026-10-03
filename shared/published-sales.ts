import { z } from "zod";
import { landRegistryRecordSchema } from "./sales";

export const publishedSaleSchema = landRegistryRecordSchema.omit({
  provenance: true,
});
export type PublishedSale = z.infer<typeof publishedSaleSchema>;
export const publishedSalesSchema = z
  .object({
    version: z.literal(1),
    source: z.object({
      name: z.literal("HM Land Registry Price Paid Data"),
      url: z.literal(
        "https://price-paid-data.publicdata.landregistry.gov.uk/pp-2025.csv",
      ),
      sourceDate: z.iso.date(),
      sourceDateBasis: z.literal("Publisher file Last-Modified date"),
      retrievedAt: z.iso.datetime(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      attribution: z.string().min(1),
      termsUrl: z.literal(
        "https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads#using-or-publishing-our-price-paid-data",
      ),
      scope: z.literal("2025 annual file · partial history"),
    }),
    outcodes: z.array(z.string()),
    counts: z.object({
      candidates: z.number().int().nonnegative(),
      residential: z.number().int().nonnegative(),
      excludedOther: z.number().int().nonnegative(),
      coordinateMatches: z.literal(0),
    }),
    records: z.array(publishedSaleSchema),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.records.map((r) => r.id));
    if (
      ids.size !== data.records.length ||
      data.records.length !== data.counts.residential ||
      data.counts.candidates !==
        data.counts.residential + data.counts.excludedOther ||
      data.records.some(
        (r) =>
          r.type === "other" ||
          !data.outcodes.includes(r.address.postcode.split(" ")[0]),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Published counts, IDs or residential scope disagree",
      });
  });
export type PublishedSales = z.infer<typeof publishedSalesSchema>;
