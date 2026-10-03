import type {
  PublishedSale,
  PublishedSales,
} from "../../shared/published-sales";
export function saleAddress(sale: PublishedSale): string {
  const a = sale.address;
  return [
    a.saon,
    [a.paon, a.street].filter(Boolean).join(" "),
    a.locality,
    a.town,
    a.postcode,
  ]
    .filter(Boolean)
    .join(", ");
}
export function filterSoldPrices(
  dataset: PublishedSales,
  query: string,
  type: string,
  category: string,
): PublishedSale[] {
  const terms = query.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const postcodeQuery = query.toUpperCase().replace(/\s/g, "");
  return dataset.records.filter((sale) => {
    if (
      (type && sale.type !== type) ||
      (category && sale.category !== category)
    )
      return false;
    const address = saleAddress(sale).toUpperCase();
    return (
      terms.every((term) => address.includes(term)) ||
      (!!postcodeQuery &&
        sale.address.postcode.replace(/\s/g, "").includes(postcodeQuery))
    );
  });
}
