import { z } from "zod";

export type Position = [number, number];
export type Bounds = [number, number, number, number];
export const positionSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-85.051129).max(85.051129),
]);
const ringSchema = z
  .array(positionSchema)
  .min(4)
  .refine(
    (ring) => ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1],
    "Polygon rings must be closed",
  );
export const provenanceSchema = z.object({
  source: z.string().min(1),
  date: z.iso.date(),
  license: z.string().min(1),
  url: z.url().optional(),
  quality: z.enum(["mapped", "estimated", "fixture"]),
});
export type Provenance = z.infer<typeof provenanceSchema>;
export const buildingSchema = z
  .object({
    id: z.string().min(1),
    rings: z.array(ringSchema).min(1),
    height: z.number().finite().positive().max(300),
    minHeight: z.number().finite().min(0),
    heightSource: z.enum(["measured", "levels", "estimated"]),
    kind: z.string(),
    name: z.string().optional(),
    address: z.string().optional(),
  })
  .refine((b) => b.minHeight < b.height, "Building base must be below its top");
export type Building = z.infer<typeof buildingSchema>;
export const transactionSchema = z.object({
  id: z.string().min(1),
  propertyRef: z.string().min(1),
  price: z.number().int().positive(),
  date: z.iso.date(),
  type: z.enum(["detached", "semi-detached", "terraced", "flat", "other"]),
  tenure: z.enum(["freehold", "leasehold", "unknown"]),
  provenance: provenanceSchema,
});
export type Transaction = z.infer<typeof transactionSchema>;

/** An address/property identifier is NOT an OSM building or a transaction ID. */
export interface PropertyLocation {
  id: string;
  uprn?: string;
  buildingId?: string;
  position: Position;
  match: "verified-uprn" | "address-match" | "manual-fixture";
  provenance: Provenance;
}
export interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
}
export interface Listing {
  id: string;
  propertyRef?: string;
  position: Position;
  askingPrice: number;
  provider: string;
  updatedAt: string;
}
export interface ListingProvider {
  search(bounds: Bounds, filters: ListingFilters): Promise<Listing[]>;
  get(id: string): Promise<Listing | null>;
}
export interface Place {
  id: string;
  name: string;
  position: Position;
  kind: string;
}
export interface Geography {
  version: 2;
  bounds: Bounds;
  provenance: Provenance;
  buildings: Building[];
  places: Place[];
  buildingCount: number;
  chunks: BuildingChunk[];
  tiles: string;
  searchUrl: string;
  lookupUrl: string;
}
export interface BuildingChunk {
  id: string;
  bounds: Bounds;
  count: number;
  url: string;
  sha256: string;
}
export type SearchBuilding = Pick<
  Building,
  "id" | "name" | "address" | "kind"
> & { position: Position };
export interface Neighbourhood {
  id: string;
  name: string;
  rings: Position[][];
  population: number;
  areaKm2: number;
  geographyType: "illustrative-area" | "OA" | "LSOA";
  provenance: Provenance;
}
