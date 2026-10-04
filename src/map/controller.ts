import * as maplibre from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { REGION } from "../../shared/config";
import { centre } from "../../shared/geo";
import type { Building, Geography, Position } from "../../shared/types";
import { BuildingLayer } from "../scene/layer";
import { mapStyle, buildingFeatures } from "./style";
import { BuildingRepository } from "./repository";

maplibre.setWorkerUrl(workerUrl);
export interface Layers {
  buildings: boolean;
  neighbourhood: boolean;
  labels: boolean;
}
export class MapController {
  readonly map: maplibre.Map;
  readonly scene: BuildingLayer;
  readonly repository: BuildingRepository;
  private labels: maplibre.Marker[] = [];
  private comparables: maplibre.Marker[] = [];
  private selected?: string;

  constructor(
    private geography: Geography,
    onSelect: (id: string) => void,
  ) {
    this.repository = new BuildingRepository(geography);
    this.map = new maplibre.Map({
      container: "map",
      style: mapStyle(geography),
      ...REGION.initialView,
      maxBounds: [
        [REGION.bounds[0], REGION.bounds[1]],
        [REGION.bounds[2], REGION.bounds[3]],
      ],
      minZoom: REGION.minZoom,
      maxZoom: REGION.maxZoom,
      maxPitch: 65,
      renderWorldCopies: false,
      canvasContextAttributes: { antialias: true },
      attributionControl: {
        compact: true,
        customAttribution:
          "© OS / HM Land Registry 2026",
      },
    });
    this.map
      .getCanvas()
      .setAttribute(
        "aria-label",
        "Interactive 3D map of greater Reading. Search also provides keyboard building selection.",
      );
    this.scene = new BuildingLayer(
      geography.chunks,
      matchMedia("(max-width: 700px)").matches,
    );
    this.map.addControl(
      new maplibre.ScaleControl({ unit: "metric", maxWidth: 90 }),
      "bottom-right",
    );
    this.map.on("load", () => {
      this.map.addLayer(this.scene, "selection-outline");
      const places = geography.buildings.filter((b) =>
        [
          "Reading Town Hall",
          "Reading Abbey",
          "Broad Street Mall",
          "Christchurch Meadows",
          "The Hexagon",
        ].includes(b.name ?? ""),
      );
      for (const b of places) {
        const label = document.createElement("span");
        label.className = "place-label";
        label.textContent = b.name!;
        this.labels.push(
          new maplibre.Marker({ element: label })
            .setLngLat(centre(b.rings))
            .addTo(this.map),
        );
      }
    });
    this.map.on("click", (event) => {
      const id =
        this.scene.pick(event.point.x, event.point.y) ??
        this.map.queryRenderedFeatures(event.point, {
          layers: ["building-overview", "footprints"],
        })[0]?.properties.id;
      if (typeof id === "string") onSelect(id);
    });
    this.map.on("mousemove", (event) => {
      this.map.getCanvas().style.cursor = this.map.queryRenderedFeatures(
        event.point,
        { layers: ["footprints"] },
      ).length
        ? "pointer"
        : "";
    });
  }

  async ready(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error("Map startup timed out. Check WebGL support and reload."),
          ),
        20000,
      );
      this.map.once("load", () => {
        clearTimeout(timer);
        resolve();
      });
      this.map.once("error", (e) => {
        clearTimeout(timer);
        reject(e.error);
      });
    });
  }
  select(building?: Building, fly = true): void {
    this.selected = building?.id;
    this.scene.select(building);
    (this.map.getSource("buildings") as maplibre.GeoJSONSource).setData(
      buildingFeatures(building ? [building] : []),
    );
    this.map.setFilter("selection-outline", [
      "==",
      ["get", "id"],
      building?.id ?? "",
    ]);
    if (building && fly) this.focus(centre(building.rings), 17.7);
  }
  focus(position: Position, zoom = 16.8): void {
    const mobile = matchMedia("(max-width: 700px)").matches;
    this.map.flyTo({
      center: position,
      zoom,
      pitch: 52,
      duration: this.duration(),
      offset: mobile ? [0, -100] : [150, 0],
    });
  }
  overview(): void {
    this.map.fitBounds(
      [
        [REGION.bounds[0], REGION.bounds[1]],
        [REGION.bounds[2], REGION.bounds[3]],
      ],
      { padding: 45, pitch: 0, bearing: 0, duration: this.duration() },
    );
  }
  home(): void {
    this.map.flyTo({
      ...REGION.initialView,
      offset: [0, 0],
      duration: this.duration(),
    });
  }
  layers(layers: Layers): void {
    this.scene.setEnabled(layers.buildings);
    this.map.setLayoutProperty(
      "building-overview",
      "visibility",
      layers.buildings ? "visible" : "none",
    );
    for (const id of ["neighbourhood-fill", "neighbourhood-line"])
      this.map.setLayoutProperty(
        id,
        "visibility",
        layers.neighbourhood ? "visible" : "none",
      );
    for (const label of this.labels) label.getElement().hidden = !layers.labels;
  }
  showComparables(buildings: Building[], onSelect: (id: string) => void): void {
    this.comparables.forEach((marker) => marker.remove());
    this.comparables = buildings
      .filter((b) => b.id !== this.selected)
      .map((b, i) => {
        const el = document.createElement("button");
        el.className = "comparison-pin";
        el.textContent = String(i + 1);
        el.setAttribute(
          "aria-label",
          `Open sample comparable ${i + 1} (fictional sale)`,
        );
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelect(b.id);
        });
        return new maplibre.Marker({ element: el })
          .setLngLat(centre(b.rings))
          .addTo(this.map);
      });
  }
  private duration(): number {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800;
  }
  destroy(): void {
    this.comparables.forEach((m) => m.remove());
    this.labels.forEach((m) => m.remove());
    this.map.remove();
  }
}
