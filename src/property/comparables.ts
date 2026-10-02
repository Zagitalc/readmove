import { z } from "zod";
import { distanceMetres } from "../../shared/geo";
import {
  positionSchema,
  type Position,
  type Provenance,
  type Transaction,
} from "../../shared/types";

export interface LocatedSale {
  id: string;
  propertyRef: string;
  position: Position;
  price: number;
  date: string;
  type: Transaction["type"];
  provenance: Provenance;
}
export const comparableFilterSchema = z
  .object({
    radiusMetres: z.number().finite().positive().max(20000),
    maxAgeMonths: z.number().int().positive().max(600),
    asOf: z.iso.date(),
    type: z
      .enum(["detached", "semi-detached", "terraced", "flat", "other"])
      .optional(),
    minPrice: z.number().finite().nonnegative().optional(),
    maxPrice: z.number().finite().positive().optional(),
  })
  .refine(
    (f) => f.minPrice == null || f.maxPrice == null || f.minPrice <= f.maxPrice,
    "Minimum price exceeds maximum price",
  );
export type ComparableFilters = z.infer<typeof comparableFilterSchema>;

/** Descriptive comparables only; no valuation and no mixing fictional and observed sales. */
export function findComparableSales<T extends LocatedSale>(
  subject: { propertyRef: string; position: Position; provenance: Provenance },
  sales: T[],
  input: ComparableFilters,
) {
  const filters = comparableFilterSchema.parse(input);
  positionSchema.parse(subject.position);
  const end = new Date(filters.asOf + "T00:00:00Z");
  // Clamp to the last day of the target month (e.g. March 31 minus one month).
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - filters.maxAgeMonths, 1),
  );
  const lastDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  start.setUTCDate(Math.min(end.getUTCDate(), lastDay));
  const oldest = start.toISOString().slice(0, 10);
  return sales
    .filter(
      (sale) =>
        positionSchema.safeParse(sale.position).success &&
        z.iso.date().safeParse(sale.date).success &&
        sale.propertyRef !== subject.propertyRef &&
        (sale.provenance.quality === "fixture") ===
          (subject.provenance.quality === "fixture") &&
        sale.date >= oldest &&
        sale.date <= filters.asOf &&
        (!filters.type || sale.type === filters.type) &&
        (filters.minPrice == null || sale.price >= filters.minPrice) &&
        (filters.maxPrice == null || sale.price <= filters.maxPrice),
    )
    .map((sale) => ({
      ...sale,
      distanceMetres: distanceMetres(subject.position, sale.position),
    }))
    .filter(
      (sale) =>
        Number.isFinite(sale.distanceMetres) &&
        sale.distanceMetres <= filters.radiusMetres,
    )
    .sort(
      (a, b) =>
        a.distanceMetres - b.distanceMetres ||
        b.date.localeCompare(a.date) ||
        a.id.localeCompare(b.id),
    );
}
