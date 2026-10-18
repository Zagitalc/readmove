import type {
  PublishedSales,
  PublishedSale,
} from "../../shared/published-sales";
import type { VerifiedLocations } from "../../shared/verified-locations";
import type { SoldFilters } from "./located-sales";
export type SaleSort =
  "distance" | "newest" | "oldest" | "price-low" | "price-high";
export const defaultSoldFilters = (): SoldFilters => ({
  query: "",
  type: "",
  category: "A",
  identifierOnly: false,
  radius: 1000,
  since: "",
});
/** Sort a copy of the complete result set before pagination. IDs break equal-value ties. */
export function sortSales(
  rows: PublishedSale[],
  sort: SaleSort,
  distances = new Map<string, number>(),
) {
  return [...rows].sort((a, b) => {
    let difference = 0;
    if (sort === "distance")
      difference =
        (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity);
    if (sort === "price-low") difference = a.price - b.price;
    if (sort === "price-high") difference = b.price - a.price;
    if (sort === "oldest") difference = a.date.localeCompare(b.date);
    if (sort === "newest") difference = b.date.localeCompare(a.date);
    return (
      difference || b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
    );
  });
}
/** Exact, non-ambiguous UPRN membership only; never infer history from an address or shared point. */
export function uprnHistory(
  data: PublishedSales,
  locations: VerifiedLocations,
  uprn: string,
  asOf: string,
) {
  const ids = new Set(
    locations.identifiers
      .filter((i) => i.uprn === uprn)
      .map((i) => i.transactionId),
  );
  return sortSales(
    data.records.filter((s) => ids.has(s.id) && s.date <= asOf),
    "newest",
  );
}
export function filterSummary(
  filters: SoldFilters,
  selected: boolean,
  mappable: boolean,
) {
  const type =
    (
      {
        flat: "Flat / maisonette",
        "semi-detached": "Semi-detached",
        detached: "Detached",
        terraced: "Terraced",
      } as Record<string, string>
    )[filters.type] ?? "All residential types";
  return [
    type,
    filters.category ? `Category ${filters.category}` : "Both categories",
    ...(selected
      ? [
          `Within ${filters.radius >= 1000 ? `${filters.radius / 1000} km` : `${filters.radius} m`}`,
          filters.since ? `Since ${filters.since}` : "All dates in snapshot",
        ]
      : [
          ...(filters.query.trim() ? [`Search: ${filters.query.trim()}`] : []),
          ...(filters.identifierOnly ? ["Official UPRN only"] : []),
          ...(mappable ? ["In-map locations only"] : []),
        ]),
  ].join(" · ");
}
