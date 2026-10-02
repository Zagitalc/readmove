import { expect, it } from "vitest";
import { Vector2 } from "three";
import type { Building } from "../../shared/types";
import { buildGeometry, roofProfile } from "../../src/scene/geometry";

const building: Building = {
  id: "test-house",
  kind: "house",
  height: 8,
  minHeight: 0,
  heightSource: "levels",
  rings: [
    [
      [-0.97, 51.45],
      [-0.9699, 51.45],
      [-0.9699, 51.4501],
      [-0.97, 51.4501],
      [-0.97, 51.45],
    ],
  ],
};
const rectangle = [
  [0, 0],
  [12, 0],
  [12, 8],
  [0, 8],
].map(([x, y]) => new Vector2(x, y));
it("adds a bounded ridge only to eligible residential footprints", () => {
  const profile = roofProfile(building, rectangle);
  expect(profile.pitched).toBe(true);
  expect(profile.top(new Vector2(6, 4))).toBe(8);
  expect(profile.eaves).toBeLessThan(8);
  expect(
    roofProfile({ ...building, kind: "commercial" }, rectangle).pitched,
  ).toBe(false);
  expect(roofProfile({ ...building, height: 30 }, rectangle).pitched).toBe(
    false,
  );
  expect(
    roofProfile(
      { ...building, rings: [building.rings[0], building.rings[0]] },
      rectangle,
    ).pitched,
  ).toBe(false);
});
it("produces finite selectable meshes that preserve the top height and dispose cleanly", () => {
  const result = buildGeometry([building]);
  for (const geometry of Object.values(result)) {
    const positions = [...geometry.getAttribute("position").array];
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(geometry.userData.buildingIds.length).toBe(positions.length / 9);
    expect(
      geometry.userData.buildingIds.every((id: string) => id === building.id),
    ).toBe(true);
    geometry.dispose();
  }
  const roofZ = [...result.roofs.getAttribute("position").array].filter(
    (_, i) => i % 3 === 2,
  );
  expect(Math.max(...roofZ)).toBeCloseTo(8);
});
