import { expect, it } from "vitest";
import { MercatorCoordinate } from "maplibre-gl";
import { REGION } from "../../shared/config";
import { chooseChunks, DETAIL_ZOOM } from "../../src/scene/chunks";
import { localPoint } from "../../src/scene/geometry";
import type { BuildingChunk, Bounds } from "../../shared/types";

const make = (id: string, bounds: Bounds, count = 100): BuildingChunk => ({
  id,
  bounds,
  count,
  url: `/data/v2/chunks/${id}.json`,
  sha256: "a".repeat(64),
});
it("selects nearest intersecting chunks within both chunk and building budgets", () => {
  const rows = [
    make("1_1", [-0.99, 51.45, -0.98, 51.46]),
    make("2_1", [-0.98, 51.45, -0.97, 51.46]),
    make("3_1", [-0.97, 51.45, -0.96, 51.46]),
    make("9_9", [-0.9, 51.48, -0.89, 51.49]),
  ];
  const selected = chooseChunks(
    rows,
    [-0.99, 51.45, -0.96, 51.46],
    [-0.975, 51.455],
    2,
    150,
  );
  expect(selected.map((c) => c.id)).toEqual(["2_1"]);
  expect(
    chooseChunks(rows, [-0.99, 51.45, -0.96, 51.46], [-0.975, 51.455], 2, 300),
  ).toHaveLength(2);
  expect(DETAIL_ZOOM).toBe(15);
});
it("keeps worker coordinate transforms aligned with MapLibre throughout the enlarged bounds", () => {
  const origin = MercatorCoordinate.fromLngLat(REGION.origin),
    scale = origin.meterInMercatorCoordinateUnits();
  for (const point of [[-1.08, 51.39], [-0.84, 51.5], REGION.origin] as [
    number,
    number,
  ][]) {
    const m = MercatorCoordinate.fromLngLat(point),
      local = localPoint(point);
    expect(local.x).toBeCloseTo((m.x - origin.x) / scale, 5);
    expect(local.y).toBeCloseTo((origin.y - m.y) / scale, 5);
  }
});
