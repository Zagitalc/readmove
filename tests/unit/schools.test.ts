import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bngToOsgb36, bngToWgs84 } from "../../shared/bng";
import { REGION } from "../../shared/config";
import { inBounds } from "../../shared/geo";
import { lsoaAt, neighbourhoodsSchema } from "../../shared/neighbourhoods";
import { schoolsSchema } from "../../shared/schools";
import { buildSchools, websiteUrl } from "../../scripts/schools/build";
import {
  filterSchools,
  loadSchools,
  nearbySchools,
  defaultSchoolFilters,
  schoolFeatures,
} from "../../src/schools/schools";

const published = schoolsSchema.parse(
  JSON.parse(readFileSync("public/data/schools.v1.json", "utf8")),
);
const deg = 180 / Math.PI;

describe("British National Grid conversion", () => {
  it("reproduces the Ordnance Survey worked example", () => {
    const [lon, lat] = bngToOsgb36(651409.903, 313177.27);
    // 52°39′27.2531″N 1°43′4.5177″E on OSGB36
    expect(lat * deg).toBeCloseTo(52 + 39 / 60 + 27.2531 / 3600, 6);
    expect(lon * deg).toBeCloseTo(1 + 43 / 60 + 4.5177 / 3600, 6);
    const [wlon, wlat] = bngToWgs84(651409.903, 313177.27);
    expect(wlat).toBeCloseTo(52 + 39 / 60 + 28.8282 / 3600, 4);
    expect(wlon).toBeCloseTo(1 + 42 / 60 + 57.8663 / 3600, 4);
  });
});

const header = [
  "URN",
  "EstablishmentName",
  "TypeOfEstablishment (name)",
  "PhaseOfEducation (name)",
  "EstablishmentStatus (name)",
  "StatutoryLowAge",
  "StatutoryHighAge",
  "LA (name)",
  "Postcode",
  "SchoolWebsite",
  "Easting",
  "Northing",
  "LSOA (code)",
].join(",");
const row = (over: Record<string, string> = {}) => {
  const base: Record<string, string> = {
    URN: "100001",
    EstablishmentName: "Test Primary",
    "TypeOfEstablishment (name)": "Community school",
    "PhaseOfEducation (name)": "Primary",
    "EstablishmentStatus (name)": "Open",
    StatutoryLowAge: "4",
    StatutoryHighAge: "11",
    "LA (name)": "Reading",
    Postcode: "RG1 1AA",
    SchoolWebsite: "www.example.org",
    Easting: "471300",
    Northing: "173600",
    "LSOA (code)": "E01000001",
    ...over,
  };
  return header
    .split(",")
    .map((c) => JSON.stringify(base[c]))
    .join(",");
};
describe("GIAS import", () => {
  it("keeps open in-bounds schools, counting closed and uncoordinated rows", () => {
    const csv = [
      header,
      row(),
      row({ URN: "100002", "EstablishmentStatus (name)": "Closed" }),
      row({ URN: "100003", Easting: "", Northing: "" }),
      row({ URN: "100004", Easting: "300000", Northing: "300000" }),
      row({
        URN: "100005",
        "EstablishmentStatus (name)": "Open, but proposed to close",
        StatutoryLowAge: "",
        StatutoryHighAge: "",
      }),
    ].join("\n");
    const { schools, counts } = buildSchools(csv, REGION.bounds);
    expect(schools.map((s) => s.urn)).toEqual(["100001", "100005"]);
    expect(counts).toMatchObject({
      sourceRows: 5,
      inBoundsOpen: 2,
      closedInBounds: 1,
      missingCoordinates: 1,
    });
    expect(schools[0].ageRange).toEqual([4, 11]);
    expect(schools[1].ageRange).toBeUndefined();
    expect(schools[0].website).toBe("http://www.example.org/");
  });
  it("fails loudly when the publisher changes columns and only links http(s) websites", () => {
    expect(() =>
      buildSchools(
        header.replace("Easting", "E") + "\n" + row(),
        REGION.bounds,
      ),
    ).toThrow(/Missing columns/);
    expect(websiteUrl("javascript:alert(1)")).toBeUndefined();
    expect(websiteUrl("not a site")).toBeUndefined();
    expect(websiteUrl("")).toBeUndefined();
    expect(websiteUrl("https://school.example/path")).toBe(
      "https://school.example/path",
    );
  });
});

describe("published schools asset", () => {
  it("records source, extract date, licence and checksum; all open and inside the map", () => {
    expect(published.schools.length).toBe(published.counts.inBoundsOpen);
    expect(published.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(published.source.extractDate).toBe("2026-10-18");
    expect(
      published.schools.every(
        (s) =>
          inBounds(s.position, REGION.bounds) && s.status.startsWith("Open"),
      ),
    ).toBe(true);
    expect(published.schools.some((s) => s.name.includes("'"))).toBe(true);
  });
  it("places known schools plausibly and agrees with the 2021 LSOA geography", () => {
    const reading = published.schools.find((s) => s.name === "Reading School")!;
    expect(Math.abs(reading.position[0] + 0.9544)).toBeLessThan(0.002);
    expect(Math.abs(reading.position[1] - 51.4484)).toBeLessThan(0.002);
    const areas = neighbourhoodsSchema.parse(
      JSON.parse(readFileSync("public/data/neighbourhoods.v1.json", "utf8")),
    ).areas;
    expect(
      published.schools.every((s) => lsoaAt(s.position, areas) !== undefined),
    ).toBe(true);
  });
  it("sorts nearby schools by straight-line distance within a radius", () => {
    const near = nearbySchools(REGION.origin, published.schools, 1500, 5);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((n) => n.metres <= 1500)).toBe(true);
    expect(near.map((n) => n.metres)).toEqual(
      [...near.map((n) => n.metres)].sort((a, b) => a - b),
    );
    expect(nearbySchools([0, 0], published.schools)).toEqual([]);
  });
  it("filters by phase and text and emits a feature per school", () => {
    const secondary = filterSchools(published.schools, {
      ...defaultSchoolFilters(),
      phase: "Secondary",
    });
    expect(secondary.length).toBeGreaterThan(0);
    expect(secondary.every((s) => s.phase === "Secondary")).toBe(true);
    expect(
      filterSchools(published.schools, { query: "rg1 5lw", phase: "" }).map(
        (s) => s.name,
      ),
    ).toContain("Reading School");
    expect(schoolFeatures(published.schools).features).toHaveLength(
      published.schools.length,
    );
  });
  it("retries a failed load instead of caching the failure", async () => {
    let calls = 0;
    await expect(
      loadSchools(async () => {
        calls++;
        throw new Error("offline");
      }),
    ).rejects.toThrow();
    await expect(
      loadSchools(async () => {
        calls++;
        return published;
      }),
    ).resolves.toBeDefined();
    expect(calls).toBe(2);
  });
});
