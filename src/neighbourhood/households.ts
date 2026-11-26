import { z } from "zod";

const count = z.number().int().nonnegative();
const tenure = z.object({
  total: count.positive(),
  owned: count,
  sharedOwnership: count,
  socialRent: count,
  privateRent: count,
  rentFree: count,
});
const vehicles = z.object({
  total: count.positive(),
  noCarOrVan: count,
});
const withinTotal = (counts: { total: number } & Record<string, number>) =>
  Object.values(counts).every((value) => value <= counts.total);

const householdsSchema = z.object({
  version: z.literal(1),
  geography: z.literal("December 2021 LSOA"),
  referenceDate: z.literal("2021-03-21"),
  areas: z.record(
    z.string().regex(/^[EW]01\d{6}$/),
    z.object({
      tenure: tenure.refine(withinTotal),
      vehicles: vehicles.refine(withinTotal),
    }),
  ),
});
export type HouseholdArea = z.infer<typeof householdsSchema>["areas"][string];

let pending: Promise<z.infer<typeof householdsSchema>> | undefined;
export function loadHouseholds() {
  pending ??= fetch("/data/households.v1.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Household data ${response.status}`);
      return response.json();
    })
    .then((raw) => householdsSchema.parse(raw))
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
