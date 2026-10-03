import type {
  PublishedSale,
  PublishedSales,
} from "../../shared/published-sales";
import type { SaleLocations } from "../../shared/sale-locations";
import type { LocatedSale } from "./comparables";
import { REGION } from "../../shared/config";
import { inBounds } from "../../shared/geo";
export type LocatedResidentialSale = PublishedSale & LocatedSale;
export function locateSales(
  data: PublishedSales,
  locations: SaleLocations,
): LocatedResidentialSale[] {
  if (!locations.coordinateSource) return [];
  const ids = new Map(
    locations.identifiers.map((i) => [i.transactionId, i.uprn]),
  );
  const coords = new Map(
    locations.coordinates.map((p) => [p.uprn, p.position]),
  );
  return data.records.flatMap((sale) => {
    const uprn = ids.get(sale.id),
      position = uprn && coords.get(uprn);
    if (!position || !inBounds(position, REGION.bounds)) return [];
    return [
      {
        ...sale,
        propertyRef: `uprn:${uprn}`,
        position,
        provenance: {
          source: data.source.name,
          date: data.source.sourceDate,
          license: "OGL v3.0 with PPD address conditions",
          quality: "mapped" as const,
          url: data.source.url,
        },
      },
    ];
  });
}
