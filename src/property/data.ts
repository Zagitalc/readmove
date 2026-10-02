import { z } from "zod";
import {
  buildingSchema,
  positionSchema,
  provenanceSchema,
  transactionSchema,
  type Building,
  type Geography,
  type PropertyLocation,
  type Transaction,
} from "../../shared/types";
import { centre, distanceMetres, inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
import { residential } from "../scene/geometry";
import { findComparableSales, type ComparableFilters } from "./comparables";

const geographySchema = z.object({
  version: z.literal(2),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  provenance: provenanceSchema,
  buildings: z.array(buildingSchema).min(1),
  places: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      position: positionSchema,
    }),
  ),
  buildingCount: z.number().int().positive(),
  chunks: z
    .array(
      z.object({
        id: z.string().regex(/^\d+_\d+$/),
        bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        count: z.number().int().positive(),
        url: z.string().regex(/^\/data\/v2\/chunks\/\d+_\d+\.json$/),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1),
  tiles: z.literal("/data/v2/tiles/{z}/{x}/{y}.pbf"),
  searchUrl: z.literal("/data/v2/search.json"),
  lookupUrl: z.literal("/data/v2/building-lookup.json"),
});
export function parseGeography(value: unknown): Geography {
  const result = geographySchema.parse(value);
  if (
    new Set(result.buildings.map((b) => b.id)).size !== result.buildings.length
  )
    throw new Error("Duplicate building IDs");
  if (result.bounds.some((n, i) => n !== REGION.bounds[i]))
    throw new Error("Geography does not match configured region");
  if (result.buildings.some((b) => !inBounds(centre(b.rings), result.bounds)))
    throw new Error("Building outside supported region");
  if (new Set(result.chunks.map((c) => c.id)).size !== result.chunks.length)
    throw new Error("Duplicate chunk IDs");
  if (result.chunks.reduce((n, c) => n + c.count, 0) !== result.buildingCount)
    throw new Error("Manifest building count mismatch");
  return result;
}
export function parseTransactions(value: unknown): Transaction[] {
  const rows = z.array(transactionSchema).parse(value);
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new Error("Duplicate transaction IDs");
  return rows;
}
export function buildingTitle(
  building: Pick<Building, "address" | "name" | "kind">,
): string {
  return (
    building.address ||
    building.name ||
    `${building.kind === "yes" ? "Mapped" : building.kind.replaceAll("_", " ")} building`
  );
}
export function findBuilding(
  buildings: Building[],
  id: string,
): Building | undefined {
  return buildings.find((b) => b.id === id);
}
export function createDemo(buildings: Building[]) {
  const candidates = buildings
    .filter((b) => residential(b.kind) && b.kind !== "apartments")
    .sort(
      (a, b) =>
        distanceMetres(centre(a.rings), [-0.978, 51.458]) -
        distanceMetres(centre(b.rings), [-0.978, 51.458]),
    );
  if (candidates.length < 3)
    throw new Error("Sample workflow needs three residential footprints");
  const selected = candidates[0];
  const nearby = candidates
    .filter(
      (b) => distanceMetres(centre(b.rings), centre(selected.rings)) > 100,
    )
    .slice(0, 2);
  if (nearby.length !== 2) throw new Error("Missing nearby demo footprints");
  const provenance = {
    source: "readmove development fixture",
    date: "2026-10-02",
    license: "CC0-1.0",
    quality: "fixture" as const,
  };
  const locations: PropertyLocation[] = [selected, ...nearby].map((b, i) => ({
    id: `demo-property-${i + 1}`,
    buildingId: b.id,
    position: centre(b.rings),
    match: "manual-fixture",
    provenance,
  }));
  const transactions = parseTransactions([
    {
      id: "demo-sale-1",
      propertyRef: locations[0].id,
      price: 385000,
      date: "2024-06-14",
      type: "terraced",
      tenure: "freehold",
      provenance,
    },
    {
      id: "demo-sale-2",
      propertyRef: locations[0].id,
      price: 298000,
      date: "2017-03-10",
      type: "terraced",
      tenure: "freehold",
      provenance,
    },
    {
      id: "demo-sale-3",
      propertyRef: locations[1].id,
      price: 402000,
      date: "2025-04-04",
      type: "terraced",
      tenure: "freehold",
      provenance,
    },
    {
      id: "demo-sale-4",
      propertyRef: locations[2].id,
      price: 372500,
      date: "2025-08-22",
      type: "terraced",
      tenure: "freehold",
      provenance,
    },
  ]);
  return { buildingId: selected.id, locations, transactions };
}
export function comparableSales(
  property: PropertyLocation,
  locations: PropertyLocation[],
  transactions: Transaction[],
  radius = 500,
  filters?: ComparableFilters,
): Transaction[] {
  const located = transactions.flatMap((t) => {
    const location = locations.find((p) => p.id === t.propertyRef);
    return location ? [{ ...t, position: location.position }] : [];
  });
  return findComparableSales(
    {
      propertyRef: property.id,
      position: property.position,
      provenance: property.provenance,
    },
    located,
    filters ?? {
      radiusMetres: radius,
      maxAgeMonths: 120,
      asOf: new Date().toISOString().slice(0, 10),
    },
  );
}
