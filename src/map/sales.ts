import { Marker, type Map as GLMap } from "maplibre-gl";
import { REGION } from "../../shared/config";
import { inBounds } from "../../shared/geo";
import type { LocatedResidentialSale } from "../property/located-sales";

/** Explicit optional overlay; it has no building-selection callback or inferred geometry. */
export class SalePoints {
  private markers: Marker[] = [];
  constructor(private map: GLMap) {}
  clear(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
  }
  show(
    sales: LocatedResidentialSale[],
    selected: string | undefined,
    onSelect: (id: string) => void,
  ): void {
    this.clear();
    // Distinct UPRNs can share a point. Group exact coordinates instead of covering one another.
    const groups = new Map<string, LocatedResidentialSale[]>();
    for (const s of sales) {
      if (!inBounds(s.position, REGION.bounds)) continue;
      const key = s.position.join(",");
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    for (const rows of groups.values()) {
      let index = (rows.findIndex((s) => s.id === selected) + 1) % rows.length;
      const el = document.createElement("button");
      el.className = "official-sale-pin";
      el.dataset.saleId = rows[index].id;
      el.setAttribute(
        "aria-pressed",
        String(rows.some((s) => s.id === selected)),
      );
      el.textContent =
        rows.length > 1
          ? `${rows.length} sales`
          : `£${Math.round(rows[0].price / 1000)}k`;
      el.setAttribute(
        "aria-label",
        rows.length > 1
          ? `Browse ${rows.length} official sales at this location`
          : `Open official sale £${rows[0].price.toLocaleString("en-GB")} on ${rows[0].date}`,
      );
      el.onclick = (e) => {
        e.stopPropagation();
        const row = rows[index];
        onSelect(row.id);
        index = (index + 1) % rows.length;
      };
      this.markers.push(
        new Marker({ element: el }).setLngLat(rows[0].position).addTo(this.map),
      );
    }
  }
}
