import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { REGION } from "../../shared/config";
import {
  boundsOf,
  centre,
  distanceMetres,
  inBounds,
  pointInPolygon,
} from "../../shared/geo";
import {
  buildingSchema,
  positionSchema,
  type Position,
} from "../../shared/types";
import { neighbourhoodAt } from "../../src/neighbourhood/areas";
import { parseGeography } from "../../src/property/data";

describe("geographic boundaries", () => {
  it("accepts corners and rejects invalid, swapped, non-finite and out-of-region coordinates", () => {
    expect(inBounds([-1.08, 51.39], REGION.bounds)).toBe(true);
    expect(inBounds([-0.84, 51.5], REGION.bounds)).toBe(true);
    expect(inBounds([-1.08001, 51.45], REGION.bounds)).toBe(false);
    for (const point of [
      [0, 0],
      [51.45, -0.97],
      [NaN, 51.45],
      [Infinity, 51.45],
      ["-.97", 51.45],
      [-0.97],
    ]) {
      expect(inBounds(point, REGION.bounds)).toBe(false);
    }
    expect(positionSchema.safeParse([0, 90]).success).toBe(false);
  });
  it("matches polygons including outer boundaries and excluding courtyards", () => {
    const rings: Position[][] = [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
        [1, 1],
      ],
    ];
    expect(pointInPolygon([3, 3], rings)).toBe(true);
    expect(pointInPolygon([0, 2], rings)).toBe(true);
    expect(pointInPolygon([1.5, 1.5], rings)).toBe(false);
    expect(pointInPolygon([1, 1.5], rings)).toBe(false);
    expect(pointInPolygon([5, 5], rings)).toBe(false);
  });
  it("identifies area-level fixture coverage without inventing a match", () => {
    expect(neighbourhoodAt([-0.98, 51.459])?.id).toBe("demo-west");
    expect(neighbourhoodAt([-0.96, 51.459])?.id).toBe("demo-east");
    expect(neighbourhoodAt([0, 51])).toBeUndefined();
  });
  it("computes distances in metres and footprint bounds consistently", () => {
    expect(distanceMetres([0, 0], [0, 1])).toBeCloseTo(111195, 0);
    expect(distanceMetres(REGION.origin, REGION.origin)).toBe(0);
    expect(
      boundsOf([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([1, 2, 3, 4]);
  });
});

describe("bundled dataset validation", () => {
  const raw = JSON.parse(readFileSync("public/data/geography.v2.json", "utf8"));
  it("validates every real footprint, unique IDs, bounds and provenance", () => {
    const data = parseGeography(raw);
    expect(data.buildingCount).toBeGreaterThan(97000);
    expect(data.chunks.every((c) => existsSync(`public${c.url}`))).toBe(true);
    expect(data.provenance.quality).toBe("mapped");
    expect(
      data.buildings.every((b) => inBounds(centre(b.rings), REGION.bounds)),
    ).toBe(true);
  });
  it("validates every chunk, checksum and building across the full region", async () => {
    const { createHash } = await import("node:crypto");
    const data = parseGeography(raw),
      seen = new Set<string>();
    let count = 0;
    for (const chunk of data.chunks) {
      const bytes = readFileSync(`public${chunk.url}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        chunk.sha256,
      );
      const rows = JSON.parse(bytes.toString()).map((value: unknown) =>
        buildingSchema.parse(value),
      );
      expect(rows.length).toBe(chunk.count);
      for (const b of rows) {
        expect(inBounds(centre(b.rings), REGION.bounds)).toBe(true);
        expect(seen.has(b.id)).toBe(false);
        seen.add(b.id);
        count++;
      }
    }
    expect(count).toBe(data.buildingCount);
  }, 20000);
  it("rejects duplicate IDs, broken rings and inverted heights", () => {
    expect(() =>
      parseGeography({
        ...raw,
        buildings: [raw.buildings[0], raw.buildings[0]],
      }),
    ).toThrow("Duplicate");
    expect(
      buildingSchema.safeParse({ ...raw.buildings[0], height: 0 }).success,
    ).toBe(false);
    expect(
      buildingSchema.safeParse({ ...raw.buildings[0], minHeight: 900 }).success,
    ).toBe(false);
    expect(
      buildingSchema.safeParse({
        ...raw.buildings[0],
        rings: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      }).success,
    ).toBe(false);
  });
});
