import type {
  PublishedSale,
  PublishedSales,
} from "../../shared/published-sales";
import type { VerifiedLocations } from "../../shared/verified-locations";
import type { Position } from "../../shared/types";
import { distanceMetres, inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
import { filterSoldPrices } from "./sold-prices";
export type LocatedSale = {
  sale: PublishedSale;
  uprn: string;
  position: Position;
};
export type SoldFilters = {
  query: string;
  type: string;
  category: string;
  identifierOnly: boolean;
  radius: number;
  since: string;
};
export function selectSaleFilters(filters: SoldFilters): SoldFilters {
  return { ...filters, query: "" };
}
export function locateSales(
  data: PublishedSales,
  locations?: VerifiedLocations,
): Map<string, LocatedSale> {
  const points = new Map(
    locations?.coordinates.map((c) => [c.uprn, c.position]) ?? [],
  );
  const identifiers = new Map(
    locations?.identifiers.map((i) => [i.transactionId, i.uprn]) ?? [],
  );
  const result = new Map<string, LocatedSale>();
  for (const sale of data.records) {
    const uprn = identifiers.get(sale.id);
    const position = uprn && points.get(uprn);
    if (uprn && inBounds(position, REGION.bounds))
      result.set(sale.id, { sale, uprn, position });
  }
  return result;
}
export function nearbySales(
  data: PublishedSales,
  located: Map<string, LocatedSale>,
  selected: LocatedSale,
  filters: SoldFilters,
  asOf: string,
) {
  // Address search is a discovery control, never a constraint on comparisons.
  return filterSoldPrices(data, "", filters.type, filters.category)
    .flatMap((sale) => {
      const point = located.get(sale.id);
      if (
        !point ||
        point.uprn === selected.uprn ||
        sale.date > asOf ||
        (filters.since && sale.date < filters.since)
      )
        return [];
      const distance = distanceMetres(selected.position, point.position);
      return distance <= filters.radius ? [{ ...point, distance }] : [];
    })
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        b.sale.date.localeCompare(a.sale.date) ||
        a.sale.id.localeCompare(b.sale.id),
    );
}
