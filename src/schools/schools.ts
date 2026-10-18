import type { FeatureCollection } from "geojson";
import { distanceMetres } from "../../shared/geo";
import { schoolsSchema, type School, type Schools } from "../../shared/schools";
import type { Position } from "../../shared/types";

export const SCHOOLS_URL = "/data/schools.v1.json";
let pending: Promise<Schools> | undefined;
/** Lazy, once per page; a failed load can be retried by calling again. */
export function loadSchools(
  load: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`School data ${response.status}`);
    return response.json();
  },
): Promise<Schools> {
  pending ??= load(SCHOOLS_URL)
    .then((raw) => schoolsSchema.parse(raw))
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function schoolFeatures(
  schools: School[] = [],
  selected?: string,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: schools.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: s.position },
      properties: { urn: s.urn, selected: s.urn === selected ? 1 : 0 },
    })),
  };
}

export interface SchoolFilters {
  query: string;
  phase: string;
}
export const defaultSchoolFilters = (): SchoolFilters => ({
  query: "",
  phase: "",
});
export const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function filterSchools(
  schools: School[],
  filters: SchoolFilters,
): School[] {
  const query = normalise(filters.query);
  return schools.filter(
    (s) =>
      (!filters.phase || s.phase === filters.phase) &&
      (!query ||
        normalise(`${s.name} ${s.postcode ?? ""} ${s.urn}`).includes(query)),
  );
}
export const phases = (schools: School[]): string[] =>
  [...new Set(schools.map((s) => s.phase))].sort();

/** Straight-line distance only: not a walking route, catchment or admission rule. */
export function nearbySchools(
  position: Position,
  schools: School[],
  radiusMetres = 1500,
  limit = 8,
): { school: School; metres: number }[] {
  return schools
    .map((school) => ({
      school,
      metres: distanceMetres(position, school.position),
    }))
    .filter((s) => s.metres <= radiusMetres)
    .sort(
      (a, b) => a.metres - b.metres || a.school.urn.localeCompare(b.school.urn),
    )
    .slice(0, limit);
}
export function ageLabel(school: School): string {
  return school.ageRange
    ? `ages ${school.ageRange[0]}–${school.ageRange[1]}`
    : "age range not published";
}
