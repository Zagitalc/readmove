import { LngLatBounds, Marker, type Map as LibreMap } from "maplibre-gl";
import type { LocatedSale } from "../property/located-sales";
import { saleAddress } from "../property/sold-prices";

/** Measured on each explicit fit, including resized panels and browser orientation. */
export function saleMapPadding() {
  const rect = (selector: string) => {
    const el = document.querySelector<HTMLElement>(selector);
    return el && !el.hidden && el.getClientRects().length
      ? el.getBoundingClientRect()
      : undefined;
  };
  const panel = rect("#official-sales");
  const top =
    Math.max(rect(".topbar")?.bottom ?? 0, rect(".modes")?.bottom ?? 0) + 24;
  const right = innerWidth - (rect(".map-controls")?.left ?? innerWidth) + 24;
  const bottom =
    innerHeight -
    Math.min(
      rect(".place-dock")?.top ?? innerHeight,
      rect(".stream-status")?.top ?? innerHeight,
    ) +
    24;
  return matchMedia("(max-width: 700px)").matches
    ? {
        top,
        right,
        bottom: panel ? innerHeight - panel.top + 24 : bottom,
        left: 24,
      }
    : { top, right, bottom, left: panel ? panel.right + 24 : 24 };
}
export class SalePoints {
  private markers: Marker[] = [];
  private limits?: { bounds: LngLatBounds | null; minZoom: number };
  constructor(private map: LibreMap) {}
  show(
    points: LocatedSale[],
    selected: string | undefined,
    onSelect: (id: string) => void,
  ) {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    const groups = new Map<string, LocatedSale[]>();
    for (const point of points) {
      const key = point.position.join(",");
      groups.set(key, [...(groups.get(key) ?? []), point]);
    }
    for (const rows of groups.values()) {
      const chosen = rows.find((p) => p.sale.id === selected);
      let index = chosen ? (rows.indexOf(chosen) + 1) % rows.length : 0;
      const point = chosen ?? rows[0];
      const button = document.createElement("button");
      button.className = "sale-pin" + (chosen ? " selected" : "");
      button.dataset.saleId = point.sale.id;
      button.dataset.saleCount = String(rows.length);
      button.setAttribute(
        "aria-label",
        rows.length > 1
          ? `Browse ${rows.length} official sales at this location`
          : `Open verified sale: ${saleAddress(point.sale)}`,
      );
      button.setAttribute("aria-pressed", String(!!chosen));
      if (rows.length > 1) button.textContent = String(rows.length);
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = rows[index];
        index = (index + 1) % rows.length;
        onSelect(next.sale.id);
      });
      this.markers.push(
        new Marker({ element: button })
          .setLngLat(point.position)
          .addTo(this.map),
      );
    }
  }

  fit(points: LocatedSale[]) {
    if (!points.length) return;
    // Full-canvas constraints can prevent fitting into a small unobscured rectangle.
    // Data coverage stays unchanged; restore the normal camera limits on exit.
    this.limits ??= {
      bounds: this.map.getMaxBounds(),
      minZoom: this.map.getMinZoom(),
    };
    this.map.setMaxBounds(null);
    this.map.setMinZoom(0);
    const bounds = new LngLatBounds(points[0].position, points[0].position);
    points.forEach((p) => bounds.extend(p.position));
    this.map.fitBounds(bounds, {
      padding: saleMapPadding(),
      maxZoom: 17.5,
      pitch: 0,
      bearing: 0,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 600,
    });
  }
  clear() {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    if (this.limits) {
      this.map.stop();
      this.map.setMinZoom(this.limits.minZoom);
      this.map.setMaxBounds(this.limits.bounds);
      this.limits = undefined;
    }
  }
}
