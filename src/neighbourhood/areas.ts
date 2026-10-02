import { pointInPolygon } from "../../shared/geo";
import type { Neighbourhood, Position, Provenance } from "../../shared/types";

const provenance: Provenance = {
  source: "readmove development fixture",
  date: "2026-10-02",
  license: "CC0-1.0",
  quality: "fixture",
};
/** Deliberately NOT real census geography or observations. */
export const areas: Neighbourhood[] = [
  {
    id: "demo-west",
    name: "West · illustrative area",
    geographyType: "illustrative-area",
    rings: [
      [
        [-0.985, 51.448],
        [-0.972, 51.448],
        [-0.972, 51.466],
        [-0.985, 51.466],
        [-0.985, 51.448],
      ],
    ],
    population: 6400,
    areaKm2: 1.8,
    provenance,
  },
  {
    id: "demo-east",
    name: "East · illustrative area",
    geographyType: "illustrative-area",
    rings: [
      [
        [-0.972, 51.448],
        [-0.955, 51.448],
        [-0.955, 51.466],
        [-0.972, 51.466],
        [-0.972, 51.448],
      ],
    ],
    population: 5200,
    areaKm2: 2.4,
    provenance,
  },
];
export function neighbourhoodAt(
  position: Position,
  candidates = areas,
): Neighbourhood | undefined {
  return candidates.find((area) => pointInPolygon(position, area.rings));
}
