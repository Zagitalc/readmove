import type { FeatureCollection } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import type { Building, Geography } from "../../shared/types";
import { schoolFeatures } from "../schools/schools";
import { FLOOD_COLOURS, floodFeatures } from "../flood/flood";
import {
  areaFeatures,
  DENSITY_BREAKS,
  DENSITY_COLOURS,
} from "../neighbourhood/areas";

export function buildingFeatures(buildings: Building[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.map((b) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: b.rings },
      properties: { id: b.id },
    })),
  };
}
export function mapStyle(geography: Geography): StyleSpecification {
  const kind = (value: string): ["==", ["get", string], string] => [
    "==",
    ["get", "kind"],
    value,
  ];
  const roadWidth = [
    "interpolate",
    ["linear"],
    ["zoom"],
    13,
    1,
    17,
    [
      "match",
      ["get", "highway"],
      ["primary", "secondary", "trunk"],
      12,
      ["tertiary", "residential"],
      7,
      3,
    ],
    20,
    24,
  ] as never;
  const style: StyleSpecification = {
    version: 8,
    sources: {
      context: {
        type: "vector",
        tiles: [location.origin + geography.tiles],
        bounds: geography.bounds,
        minzoom: 10,
        maxzoom: 15,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · ODbL',
      },
      buildings: { type: "geojson", data: buildingFeatures([]) },
      areas: {
        type: "geojson",
        data: areaFeatures(),
        attribution:
          'Source: <a href="https://www.ons.gov.uk/methodology/geography/licences" target="_blank" rel="noopener">ONS</a> · OGL v3.0 · Contains OS data © Crown copyright 2025',
      },
      flood: {
        type: "geojson",
        data: floodFeatures(),
        attribution:
          '© <a href="https://environment.data.gov.uk/explore/04532375-a198-476e-985e-0579a0a11b47" target="_blank" rel="noopener">Environment Agency</a> · OGL',
      },
      schools: {
        type: "geojson",
        data: schoolFeatures(),
        attribution:
          'Schools: <a href="https://get-information-schools.service.gov.uk/" target="_blank" rel="noopener">DfE GIAS</a> · OGL v3.0',
      },
    },
    layers: [
      {
        id: "ground",
        type: "background",
        paint: { "background-color": "#eae9e1" },
      },
      {
        id: "land",
        type: "fill",
        source: "context",
        filter: kind("land"),
        paint: {
          "fill-color": [
            "match",
            ["get", "landuse"],
            ["residential", "commercial", "retail", "industrial"],
            "#e5e3d9",
            "#d5dfce",
          ],
          "fill-opacity": 0.65,
        },
      },
      {
        id: "water",
        type: "fill",
        source: "context",
        filter: ["all", kind("water"), ["==", ["geometry-type"], "Polygon"]],
        paint: { "fill-color": "#aec9c9" },
      },
      {
        id: "water-lines",
        type: "line",
        source: "context",
        filter: ["all", kind("water"), ["==", ["geometry-type"], "LineString"]],
        paint: {
          "line-color": "#aec9c9",
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 17, 12],
        },
      },
      {
        id: "neighbourhood-fill",
        type: "fill",
        source: "areas",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "step",
            ["get", "density"],
            DENSITY_COLOURS[0],
            ...DENSITY_BREAKS.flatMap((limit, i) => [
              limit,
              DENSITY_COLOURS[i + 1],
            ]),
          ] as never,
          "fill-opacity": 0.45,
        },
      },
      {
        id: "neighbourhood-line",
        type: "line",
        source: "areas",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#3b6b5a",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 16, 1.6],
          "line-opacity": 0.7,
        },
      },
      ...(["FZ2", "FZ3"] as const).map((zone) => ({
        id: `flood-${zone.toLowerCase()}`,
        type: "fill" as const,
        source: "flood",
        filter: ["==", ["get", "zone"], zone] as never,
        layout: { visibility: "none" as const },
        paint: {
          "fill-color": FLOOD_COLOURS[zone],
          "fill-opacity": zone === "FZ3" ? 0.55 : 0.45,
        },
      })),
      {
        id: "road-edge",
        type: "line",
        source: "context",
        filter: kind("road"),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#d5d2c7",
          "line-width": roadWidth,
          "line-gap-width": 1,
        },
      },
      {
        id: "roads",
        type: "line",
        source: "context",
        filter: kind("road"),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f8f7f0", "line-width": roadWidth },
      },
      {
        id: "rail",
        type: "line",
        source: "context",
        filter: kind("rail"),
        paint: {
          "line-color": "#aaa99e",
          "line-width": 1.8,
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "footprints",
        type: "fill",
        source: "context",
        filter: kind("building"),
        paint: { "fill-color": "#c7c4b6", "fill-opacity": 0.72 },
      },
      {
        id: "building-overview",
        type: "fill-extrusion",
        source: "context",
        filter: kind("building"),
        minzoom: 13,
        paint: {
          "fill-extrusion-color": "#d1cfc1",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["coalesce", ["get", "minHeight"], 0],
          "fill-extrusion-opacity": 1,
        },
      },
      {
        id: "schools-circle",
        type: "circle",
        source: "schools",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            3.5,
            16,
            7,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#9f6136",
            "#2c5f8a",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      },
      {
        id: "selection-outline",
        type: "line",
        source: "buildings",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#245e4b", "line-width": 3 },
      },
    ],
  };
  for (const layer of style.layers)
    if ("source" in layer && layer.source === "context")
      Object.assign(layer, { "source-layer": "reading" });
  return style;
}
