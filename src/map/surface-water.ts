import type { Coordinates, ImageSourceSpecification } from "maplibre-gl";

export const SURFACE_WATER_DATASET =
  "https://environment.data.gov.uk/dataset/c853dc8c-9371-4a8f-99ea-a1daa023945e";

export const SURFACE_WATER_SCENARIOS = [
  { colour: "#3d4489", caption: "3.3% (1 in 30)" },
  { colour: "#6699cc", caption: "1% (1 in 100)" },
  { colour: "#a2ceff", caption: "0.1% (1 in 1,000)" },
];

export const SURFACE_WATER_REVISION = "10 November 2026";

// The published image covers exactly these corners. Keep them tied to the
// reviewed Web Mercator WMS request when changing the main map bounds.
const coordinates: Coordinates = [
  [-1.08, 51.5],
  [-0.84, 51.5],
  [-0.84, 51.39],
  [-1.08, 51.39],
];
export const surfaceWaterSource: ImageSourceSpecification = {
  type: "image",
  url: "/data/surface-water.v1.webp",
  coordinates,
};
