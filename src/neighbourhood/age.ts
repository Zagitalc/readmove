import { z } from "zod";

export const AGE_BANDS = ["0–14", "15–24", "25–44", "45–64", "65 and over"];
const count = z.number().int().nonnegative();
const ageArea = z
  .object({
    total: count.positive(),
    bands: z.tuple([count, count, count, count, count]),
  })
  .refine(({ total, bands }) => bands.every((band) => band <= total));
const ageSchema = z.object({
  version: z.literal(1),
  geography: z.literal("December 2021 LSOA"),
  referenceDate: z.literal("2021-03-21"),
  areas: z.record(z.string().regex(/^[EW]01\d{6}$/), ageArea),
});
export type AgeArea = z.infer<typeof ageArea>;

let pending: Promise<z.infer<typeof ageSchema>> | undefined;
export function loadAge() {
  pending ??= fetch("/data/age.v1.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Age data ${response.status}`);
      return response.json();
    })
    .then((raw) => ageSchema.parse(raw))
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
