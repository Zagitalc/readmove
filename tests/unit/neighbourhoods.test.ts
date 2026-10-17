import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REGION } from "../../shared/config";
import { lsoaAt, neighbourhoodsSchema } from "../../shared/neighbourhoods";
import type { Bounds } from "../../shared/types";
import {
  areaKm2,
  buildNeighbourhoods,
  normaliseRing,
  parseNomis,
} from "../../scripts/neighbourhood/build";

const published = neighbourhoodsSchema.parse(
  JSON.parse(readFileSync("public/data/neighbourhoods.v1.json", "utf8")),
);
const header = "DATE,GEOGRAPHY_CODE,GEOGRAPHY_NAME,OBS_VALUE,OBS_STATUS\n";
const square = (x: number, y: number, size = 0.01) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];
const feature = (code: string, name: string, ring: number[][]) => ({
  type: "Feature",
  properties: { LSOA21CD: code, LSOA21NM: name },
  geometry: { type: "Polygon", coordinates: [ring] },
});
const bounds: Bounds = [-1, 51, 0, 52];
const { areas: _a, version: _v, selection: _s, ...meta } = published;
function input(overrides: Partial<Parameters<typeof buildNeighbourhoods>[0]>) {
  return {
    geojson: {
      type: "FeatureCollection",
      features: [
        feature("E01000002", "Test 001B", square(-0.5, 51.5)),
        feature("E01000001", "Test 001A", square(-0.49, 51.5)),
      ],
    },
    residentsCsv:
      header +
      "2021,E01000001,Test 001A,1500,A\n2021,E01000002,Test 001B,1800,A\n",
    densityCsv:
      header +
      "2021,E01000001,Test 001A,2154.2,A\n2021,E01000002,Test 001B,2585.0,A\n",
    bounds,
    meta,
    ...overrides,
  };
}

describe("ONS neighbourhood import", () => {
  it("joins Census values by exact LSOA code in deterministic code order", () => {
    const { asset, audit } = buildNeighbourhoods(input({}));
    expect(asset.areas.map((a) => a.code)).toEqual(["E01000001", "E01000002"]);
    expect(asset.areas[0]).toMatchObject({
      usualResidents: 1500,
      residentsPerKm2: 2154.2,
    });
    expect(audit.usualResidents).toBe(3300);
  });
  it("refuses missing statistics, name disagreements, extra codes and truncated queries", () => {
    expect(() =>
      buildNeighbourhoods(
        input({
          residentsCsv: header + "2021,E01000001,Test 001A,1500,A\n",
        }),
      ),
    ).toThrow(/missing for E01000002/);
    expect(() =>
      buildNeighbourhoods(
        input({
          densityCsv:
            header +
            "2021,E01000001,Renamed,1,A\n2021,E01000002,Test 001B,1,A\n",
        }),
      ),
    ).toThrow(/Name disagreement/);
    expect(() =>
      buildNeighbourhoods(
        input({
          residentsCsv:
            input({}).residentsCsv + "2021,E01000003,Test 001C,10,A\n",
        }),
      ),
    ).toThrow(/Unexpected Census codes/);
    expect(() =>
      buildNeighbourhoods(
        input({
          geojson: {
            ...(input({}).geojson as object),
            exceededTransferLimit: true,
          },
        }),
      ),
    ).toThrow(/truncated/);
  });
  it("rejects non-final, duplicated and unavailable Nomis observations", () => {
    expect(() => parseNomis(header + "2021,E01000001,A,1,Q\n", "x")).toThrow();
    expect(() => parseNomis(header + "2011,E01000001,A,1,A\n", "x")).toThrow();
    expect(() => parseNomis(header + "2021,E01000001,A,,A\n", "x")).toThrow();
    expect(() =>
      parseNomis(header + "2021,E01000001,A,1,A\n2021,E01000001,A,1,A\n", "x"),
    ).toThrow(/duplicate/);
  });
  it("rounds coordinates without opening or collapsing rings", () => {
    expect(
      normaliseRing([
        [0.000001, 0],
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
    expect(() =>
      normaliseRing([
        [0, 0],
        [0.000001, 0],
        [0, 0.000001],
      ]),
    ).toThrow(/collapsed/);
    // 0.01° square near Reading ≈ 0.77 km².
    expect(areaKm2([[square(-1, 51.45) as never]])).toBeCloseTo(0.77, 2);
  });
});

describe("published ONS neighbourhood asset", () => {
  it("records editions, Census date, licence and source checksums", () => {
    expect(published.areas).toHaveLength(217);
    expect(published.geography).toMatchObject({
      edition: "December 2021",
      product: "BGC V5",
    });
    expect(published.statistics.every((s) => s.referenceDate)).toBe(true);
    expect(published.attribution.join(" ")).toMatch(
      /Office for National Statistics.*Open Government Licence/,
    );
    expect(published.areas.every((a) => /^E01\d{6}$/.test(a.code))).toBe(true);
    expect([...published.areas].map((a) => a.code)).toEqual(
      published.areas.map((a) => a.code).sort(),
    );
  });
  it("finds the containing official LSOA and returns nothing outside coverage", () => {
    const townHall = lsoaAt([-0.9693, 51.4565], published.areas);
    expect(townHall?.name).toMatch(/^Reading /);
    expect(lsoaAt(REGION.origin, published.areas)).toBeDefined();
    expect(lsoaAt([-2, 53], published.areas)).toBeUndefined();
  });
  it("covers every corner of the map box", () => {
    const [w, s, e, n] = REGION.bounds;
    for (const corner of [
      [w + 0.001, s + 0.001],
      [e - 0.001, s + 0.001],
      [e - 0.001, n - 0.001],
      [w + 0.001, n - 0.001],
    ] as [number, number][])
      expect(lsoaAt(corner, published.areas)).toBeDefined();
  });
});
