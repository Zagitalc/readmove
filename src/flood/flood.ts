import type { FeatureCollection } from "geojson";
import { floodSchema, type Flood } from "../../shared/flood";

export const FLOOD_URL = "/data/flood-zones.v1.json";
export const FLOOD_COLOURS = { FZ3: "#2f6f9f", FZ2: "#8fb9d6" } as const;
let pending: Promise<Flood> | undefined;
/** Lazy, once per page; a failed load can be retried by calling again. */
export function loadFlood(
  load: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Flood data ${response.status}`);
    return response.json();
  },
): Promise<Flood> {
  pending ??= load(FLOOD_URL)
    .then((raw) => floodSchema.parse(raw))
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
export function floodFeatures(data?: Flood): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (data?.areas ?? []).map((area) => ({
      type: "Feature" as const,
      geometry: { type: "MultiPolygon" as const, coordinates: area.polygons },
      properties: { zone: area.zone },
    })),
  };
}
