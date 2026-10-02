import { intersects } from "../../shared/geo";
import type { Bounds, BuildingChunk, Position } from "../../shared/types";

export const DETAIL_ZOOM = 15;
export function chooseChunks(
  chunks: BuildingChunk[],
  bounds: Bounds,
  centre: Position,
  maxChunks: number,
  maxBuildings: number,
): BuildingChunk[] {
  const cos = Math.cos((centre[1] * Math.PI) / 180);
  const distance = (c: BuildingChunk) =>
    Math.hypot(
      ((c.bounds[0] + c.bounds[2]) / 2 - centre[0]) * cos,
      (c.bounds[1] + c.bounds[3]) / 2 - centre[1],
    );
  const candidates = chunks
    .filter((c) => intersects(c.bounds, bounds))
    .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  const selected: BuildingChunk[] = [];
  let buildings = 0;
  for (const candidate of candidates) {
    if (selected.length === maxChunks) break;
    if (buildings + candidate.count > maxBuildings) continue;
    selected.push(candidate);
    buildings += candidate.count;
  }
  return selected;
}
