import type { MultiPolygon, Polygon } from "geojson";
import type { Position, Provenance } from "./types";

/** Future datasets must carry their own dates, licences and geographic scale. Schools: see shared/schools.ts. */
export interface FloodArea {
  id: string;
  geometry: Polygon | MultiPolygon;
  category: string;
  floodType: "river-sea" | "surface-water";
  /** Official classification, not an inferred score for an individual home. */
  classificationLabel: string;
  provenance: Provenance;
}
export interface PropertyIdentifierLink {
  transactionId: string;
  uprn?: string;
  propertyRef: string;
  method: "official-lookup" | "reviewed-address-match";
  confidence: "verified" | "candidate";
  provenance: Provenance;
}
