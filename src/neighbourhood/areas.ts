import type { FeatureCollection } from "geojson";
import {
  lsoaAt,
  neighbourhoodsSchema,
  type Lsoa,
  type Neighbourhoods,
} from "../../shared/neighbourhoods";
import type { Position } from "../../shared/types";

export const NEIGHBOURHOODS_URL = "/data/neighbourhoods.v1.json";
/** Fixed published-value breaks, so colours mean the same thing in every view. */
export const DENSITY_BREAKS = [2500, 5000, 7500, 10000] as const;
export const DENSITY_COLOURS = [
  "#e4ead9",
  "#bfd2b2",
  "#8fb398",
  "#5f8f78",
  "#3b6b5a",
] as const;

let pending: Promise<Neighbourhoods> | undefined;
/** Lazy, once per page; a failed load can be retried by calling again. */
export function loadNeighbourhoods(
  load: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Neighbourhood data ${response.status}`);
    return response.json();
  },
): Promise<Neighbourhoods> {
  pending ??= load(NEIGHBOURHOODS_URL)
    .then((raw) => neighbourhoodsSchema.parse(raw))
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function neighbourhoodAt(
  position: Position,
  data: Neighbourhoods,
): Lsoa | undefined {
  return lsoaAt(position, data.areas);
}

export function areaFeatures(data?: Neighbourhoods): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (data?.areas ?? []).flatMap((area) =>
      area.polygons.map((rings) => ({
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: rings },
        properties: { code: area.code, density: area.residentsPerKm2 },
      })),
    ),
  };
}
