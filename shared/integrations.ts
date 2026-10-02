import type { MultiPolygon, Polygon } from "geojson";
import type { Position, Provenance } from "./types";

/** Future datasets must carry their own dates, licences and geographic scale. */
export interface SchoolRecord {
  urn: string;
  name: string;
  position: Position;
  phase: "primary" | "secondary" | "all-through" | "other";
  ageRange: [number, number];
  status: string;
  inspection?: {
    inspectedOn: string;
    publishedOn: string;
    findingsUrl: string;
    framework: string;
  };
  provenance: Provenance;
}
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
