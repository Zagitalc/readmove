import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from "three";
import { REGION } from "../../shared/config";
import type { Building, Position } from "../../shared/types";

const mercatorY = (latitude: number) =>
  (1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2;
const circumference =
  2 * Math.PI * 6371008.8 * Math.cos((REGION.origin[1] * Math.PI) / 180);
export function localPoint(position: Position): Vector2 {
  return new Vector2(
    ((position[0] - REGION.origin[0]) / 360) * circumference,
    (mercatorY(REGION.origin[1]) - mercatorY(position[1])) * circumference,
  );
}
export function hashId(id: string): number {
  return [...id].reduce(
    (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0,
    0,
  );
}
export function residential(kind: string): boolean {
  return [
    "house",
    "detached",
    "semidetached_house",
    "terrace",
    "residential",
    "apartments",
  ].includes(kind);
}

type Point3 = [number, number, number];
interface Batch {
  positions: number[];
  colours: number[];
  ids: string[];
}
function batch(): Batch {
  return { positions: [], colours: [], ids: [] };
}
function triangle(
  out: Batch,
  points: Point3[],
  colour: number[],
  id: string,
): void {
  out.positions.push(...points.flat());
  out.colours.push(...colour, ...colour, ...colour);
  out.ids.push(id);
}
function quad(
  out: Batch,
  a: Point3,
  b: Point3,
  c: Point3,
  d: Point3,
  colour: number[],
  id: string,
): void {
  triangle(out, [a, b, c], colour, id);
  triangle(out, [a, c, d], colour, id);
}
function finish(out: Batch): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(out.positions, 3),
  );
  geometry.setAttribute("color", new Float32BufferAttribute(out.colours, 3));
  geometry.userData.buildingIds = out.ids;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Split a triangle at the ridge so each resulting roof plane stays planar. */
function clip(
  points: Vector2[],
  value: (p: Vector2) => number,
  positive: boolean,
): Vector2[] {
  const output: Vector2[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const av = value(a),
      bv = value(b);
    const ain = positive ? av >= 0 : av <= 0,
      bin = positive ? bv >= 0 : bv <= 0;
    if (ain) output.push(a);
    if (ain !== bin) output.push(a.clone().lerp(b, av / (av - bv)));
  }
  return output;
}

/** Conservative gables on small, near-rectangular residential footprints only. */
export function roofProfile(building: Building, outer: Vector2[]) {
  let edge = new Vector2(1, 0),
    longest = 0;
  for (let i = 0; i < outer.length; i++) {
    const v = outer[(i + 1) % outer.length].clone().sub(outer[i]);
    if (v.lengthSq() > longest) {
      longest = v.lengthSq();
      edge = v.normalize();
    }
  }
  const cross = new Vector2(-edge.y, edge.x);
  const us = outer.map((p) => p.dot(edge)),
    vs = outer.map((p) => p.dot(cross));
  const width = Math.max(...vs) - Math.min(...vs),
    length = Math.max(...us) - Math.min(...us);
  const area = Math.abs(ShapeUtils.area(outer));
  const pitched =
    residential(building.kind) &&
    building.kind !== "apartments" &&
    building.height < 15 &&
    building.rings.length === 1 &&
    width > 3 &&
    width < 22 &&
    area / (width * length) > 0.83;
  const middle = (Math.max(...vs) + Math.min(...vs)) / 2;
  const rise = pitched
    ? Math.min(width * 0.29, 2.8, (building.height - building.minHeight) * 0.3)
    : 0;
  return {
    pitched,
    eaves: building.height - rise,
    signed: (p: Vector2) => p.dot(cross) - middle,
    top: (p: Vector2) =>
      building.height -
      rise +
      rise * Math.max(0, 1 - Math.abs(p.dot(cross) - middle) / (width / 2)),
  };
}

export function buildGeometry(buildings: Building[], selected = false) {
  const walls = batch(),
    roofs = batch(),
    windows = batch();
  for (const b of buildings) {
    const rings = b.rings.map((r) => r.slice(0, -1).map(localPoint));
    const profile = roofProfile(b, rings[0]);
    const warm = (hashId(b.id) % 5) * 0.017;
    const wall = selected
      ? [0.34, 0.58, 0.49]
      : residential(b.kind)
        ? [0.8 + warm, 0.77 + warm, 0.7 + warm]
        : [0.84, 0.84, 0.79];
    const roof = selected
      ? [0.2, 0.39, 0.33]
      : profile.pitched
        ? [0.49 + warm, 0.48, 0.43]
        : [0.7, 0.71, 0.66];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          c = ring[(i + 1) % ring.length];
        const segments = [a];
        const av = profile.signed(a),
          cv = profile.signed(c);
        if (profile.pitched && av * cv < 0)
          segments.push(a.clone().lerp(c, av / (av - cv)));
        segments.push(c);
        for (let j = 0; j < segments.length - 1; j++) {
          const p = segments[j],
            q = segments[j + 1];
          quad(
            walls,
            [p.x, p.y, b.minHeight],
            [q.x, q.y, b.minHeight],
            [q.x, q.y, profile.top(q)],
            [p.x, p.y, profile.top(p)],
            wall,
            b.id,
          );
        }
        const length = a.distanceTo(c);
        if (!residential(b.kind) || length < 4 || length > 35 || b.height > 20)
          continue;
        const direction = c.clone().sub(a).normalize();
        // Both sides render; a tiny offset avoids z-fighting without assuming ring winding.
        const offset = new Vector2(-direction.y, direction.x).multiplyScalar(
          0.035,
        );
        for (let along = 1.6; along < length - 1; along += 3.2) {
          for (let z = b.minHeight + 1.6; z < profile.eaves - 1; z += 3) {
            const p = a.clone().addScaledVector(direction, along - 0.43);
            const q = a.clone().addScaledVector(direction, along + 0.43);
            for (const side of [-1, 1]) {
              quad(
                windows,
                [p.x + offset.x * side, p.y + offset.y * side, z],
                [q.x + offset.x * side, q.y + offset.y * side, z],
                [q.x + offset.x * side, q.y + offset.y * side, z + 1.05],
                [p.x + offset.x * side, p.y + offset.y * side, z + 1.05],
                [0.43, 0.48, 0.46],
                b.id,
              );
            }
          }
        }
      }
    }
    const points = rings.flat();
    for (const indices of ShapeUtils.triangulateShape(
      rings[0],
      rings.slice(1),
    )) {
      const tri = indices.map((i) => points[i]);
      const pieces = profile.pitched
        ? [clip(tri, profile.signed, true), clip(tri, profile.signed, false)]
        : [tri];
      for (const piece of pieces)
        for (let i = 1; i < piece.length - 1; i++) {
          triangle(
            roofs,
            [piece[0], piece[i], piece[i + 1]].map((p) => [
              p.x,
              p.y,
              profile.top(p),
            ]),
            roof,
            b.id,
          );
        }
    }
  }
  return {
    walls: finish(walls),
    roofs: finish(roofs),
    windows: finish(windows),
  };
}
