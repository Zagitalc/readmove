import { positionSchema, type Bounds, type Position } from "./types";

export function inBounds(point: unknown, bounds: Bounds): point is Position {
  const parsed = positionSchema.safeParse(point);
  if (!parsed.success) return false;
  const [x, y] = parsed.data;
  return x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3];
}

/** Returns 0 outside, 1 inside, 2 on the boundary. */
function ringContains([x, y]: Position, ring: Position[]): number {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (
      Math.abs(cross) < 1e-12 &&
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) &&
      y <= Math.max(yi, yj)
    )
      return 2;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside ? 1 : 0;
}

/** Outer boundaries included; holes and their boundaries excluded. */
export function pointInPolygon(point: Position, rings: Position[][]): boolean {
  if (!positionSchema.safeParse(point).success || !rings[0]) return false;
  return (
    ringContains(point, rings[0]) > 0 &&
    rings.slice(1).every((r) => ringContains(point, r) === 0)
  );
}

export function boundsOf(points: Position[]): Bounds {
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
export function centre(rings: Position[][]): Position {
  const b = boundsOf(rings[0]);
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}
export function intersects(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
export function distanceMetres(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
    Math.cos(a[1] * rad) *
      Math.cos(b[1] * rad) *
      Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
