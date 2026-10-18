import { parse } from "csv-parse/sync";
import { z } from "zod";
import { bngToWgs84 } from "../../shared/bng";
import { inBounds } from "../../shared/geo";
import { schoolSchema, type School } from "../../shared/schools";
import type { Bounds } from "../../shared/types";

const number = (value: string) => (/^\d+$/.test(value) ? Number(value) : NaN);
const rowSchema = z.object({
  URN: z.string().regex(/^[1-9]\d{5}$/),
  EstablishmentName: z.string().min(1),
  "TypeOfEstablishment (name)": z.string().min(1),
  "PhaseOfEducation (name)": z.string(),
  "EstablishmentStatus (name)": z.string(),
  StatutoryLowAge: z.string(),
  StatutoryHighAge: z.string(),
  "LA (name)": z.string(),
  Postcode: z.string(),
  SchoolWebsite: z.string(),
  Easting: z.string(),
  Northing: z.string(),
  "LSOA (code)": z.string(),
});
export const REQUIRED_COLUMNS = Object.keys(rowSchema.shape);

/** Publisher websites are often scheme-less; only http(s) is ever linked. */
export function websiteUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const url = new URL(candidate);
    return /^https?:$/.test(url.protocol) && url.hostname.includes(".")
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function buildSchools(csv: string, bounds: Bounds) {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as Record<string, string>[];
  const header = Object.keys(rows[0] ?? {});
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
  const schools: School[] = [];
  let missingCoordinates = 0,
    closedInBounds = 0;
  for (const raw of rows) {
    const row = rowSchema.parse(
      Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, raw[c]])),
    );
    const e = number(row.Easting),
      n = number(row.Northing);
    if (Number.isNaN(e) || Number.isNaN(n) || e === 0 || n === 0) {
      missingCoordinates++;
      continue;
    }
    const [lon, lat] = bngToWgs84(e, n);
    const position: [number, number] = [round(lon), round(lat)];
    if (!inBounds(position, bounds)) continue;
    const status = row["EstablishmentStatus (name)"];
    if (status !== "Open" && status !== "Open, but proposed to close") {
      closedInBounds++;
      continue;
    }
    const low = number(row.StatutoryLowAge),
      high = number(row.StatutoryHighAge);
    const phase = row["PhaseOfEducation (name)"];
    schools.push(
      schoolSchema.parse({
        urn: row.URN,
        name: row.EstablishmentName.trim(),
        type: row["TypeOfEstablishment (name)"],
        phase: phase || "Not applicable",
        status,
        ageRange:
          Number.isNaN(low) || Number.isNaN(high) || low > high
            ? undefined
            : [low, high],
        authority: row["LA (name)"] || "Not published",
        postcode: row.Postcode.trim() || undefined,
        website: websiteUrl(row.SchoolWebsite),
        position,
      }),
    );
  }
  schools.sort((a, b) => a.urn.localeCompare(b.urn));
  return {
    schools,
    counts: {
      sourceRows: rows.length,
      inBoundsOpen: schools.length,
      closedInBounds,
      missingCoordinates,
    },
  };
}
