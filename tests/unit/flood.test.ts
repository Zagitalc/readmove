import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REGION } from "../../shared/config";
import { floodSchema, floodZoneAt, footprintFlood } from "../../shared/flood";
import type { Position } from "../../shared/types";
import {
  buildFlood,
  clipRing,
  pageSchema,
  simplifyRing,
} from "../../scripts/flood/build";
import { floodFeatures, loadFlood } from "../../src/flood/flood";

const published = floodSchema.parse(
  JSON.parse(readFileSync("public/data/flood-zones.v1.json", "utf8")),
);
const square = (x: number, y: number, size: number): number[][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];
const page = (features: unknown[], matched = features.length) =>
  pageSchema.parse({
    type: "FeatureCollection",
    timeStamp: "2026-10-18T15:21:49.523Z",
    numberMatched: matched,
    numberReturned: features.length,
    links: [],
    features,
  });
const feature = (
  ring: number[][],
  zone = "FZ3",
  source: string | null = "river",
  origin: string | null = "modelled",
) => ({
  type: "Feature",
  properties: { origin, flood_zone: zone, flood_source: source },
  geometry: { type: "Polygon", coordinates: [ring] },
});

describe("flood geometry preparation", () => {
  it("simplifies within the tolerance and keeps real corners", () => {
    const wiggle: Position[] = [
      [0, 0],
      [0.0005, 0.0000001],
      [0.001, 0],
      [0.001, 0.001],
      [0, 0.001],
      [0, 0],
    ];
    const out = simplifyRing(wiggle, 4);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual(out.at(-1));
    expect(simplifyRing(wiggle, 0.001)).toHaveLength(6);
  });
  it("clips rings to a box and drops rings wholly outside", () => {
    const box: [number, number, number, number] = [0, 0, 1, 1];
    const clipped = clipRing(square(0.5, 0.5, 2) as Position[], box);
    const xs = clipped.map((p) => p[0]),
      ys = clipped.map((p) => p[1]);
    expect(Math.max(...xs)).toBe(1);
    expect(Math.max(...ys)).toBe(1);
    expect(Math.min(...xs)).toBe(0.5);
    expect(clipped[0]).toEqual(clipped.at(-1));
    expect(clipRing(square(5, 5, 1) as Position[], box)).toEqual([]);
  });
  it("groups by zone, source and origin and labels missing values", () => {
    const pages = [
      page([
        feature(square(-0.9, 51.45, 0.01)),
        feature(square(-0.95, 51.45, 0.01)),
        feature(square(-0.9, 51.42, 0.01), "FZ2", null, null),
      ]),
    ];
    const built = buildFlood(pages, REGION.bounds, 4);
    expect(built.areas).toHaveLength(2);
    expect(built.areas[0]).toMatchObject({
      zone: "FZ2",
      source: "Not stated",
      origin: "Not stated",
    });
    expect(built.areas[1].polygons).toHaveLength(2);
    expect(built.counts).toEqual({
      sourceFeatures: 3,
      zone2Features: 1,
      zone3Features: 2,
    });
  });
  it("rejects duplicates across pages and unknown zones", () => {
    const f = feature(square(-0.9, 51.45, 0.01));
    expect(() => buildFlood([page([f]), page([f])], REGION.bounds, 4)).toThrow(
      /Duplicate/,
    );
    expect(() => page([feature(square(0, 0, 1), "FZ1")])).toThrow();
  });
});

describe("published flood asset", () => {
  it("records source, revision, licence and per-page checksums", () => {
    expect(published.source.pages.reduce((n, p) => n + p.features, 0)).toBe(
      published.counts.sourceFeatures,
    );
    expect(
      published.source.pages.every((p) => /^[a-f0-9]{64}$/.test(p.sha256)),
    ).toBe(true);
    expect(published.source.attribution).toMatch(/Environment Agency/);
    expect(published.scenario).toMatch(
      /ignoring the benefits of flood defences/,
    );
    expect(published.processing.publishedVertices).toBeLessThan(
      published.processing.sourceVertices,
    );
    // Zone 2 draws first so Zone 3 sits on top.
    const zones = published.areas.map((a) => a.zone);
    expect(zones).toEqual([...zones].sort());
  });
  it("places the Thames floodplain in Zone 3 and the town centre outside the zones", () => {
    expect(floodZoneAt([-0.9585, 51.4625], published.areas)?.zone).toBe("FZ3");
    expect(floodZoneAt([-0.9693, 51.4565], published.areas)).toBeUndefined();
    expect(floodZoneAt([-2, 53], published.areas)).toBeUndefined();
  });
  it("reports centre and outline hits separately", () => {
    const wet: Position = [-0.9585, 51.4625];
    const dry: Position = [-0.9693, 51.4565];
    expect(footprintFlood(wet, [wet], published.areas).centre?.zone).toBe(
      "FZ3",
    );
    const edge = footprintFlood(dry, [dry, wet], published.areas);
    expect(edge.centre).toBeUndefined();
    expect(edge.outline?.zone).toBe("FZ3");
    expect(footprintFlood(dry, [dry], published.areas)).toEqual({
      centre: undefined,
      outline: undefined,
    });
  });
  it("emits one map feature per area and retries failed loads", async () => {
    expect(floodFeatures(published).features).toHaveLength(
      published.areas.length,
    );
    expect(floodFeatures().features).toEqual([]);
    let calls = 0;
    await expect(
      loadFlood(async () => {
        calls++;
        throw new Error("offline");
      }),
    ).rejects.toThrow();
    await expect(
      loadFlood(async () => {
        calls++;
        return published;
      }),
    ).resolves.toBeDefined();
    expect(calls).toBe(2);
  });
});
