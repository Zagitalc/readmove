import type { Bounds, Position } from "./types";

export const BOUNDS: Bounds = [-1.08, 51.39, -0.84, 51.5];

export const REGION = {
  id: "greater-reading",
  name: "Reading",
  subtitle: "Berkshire",
  bounds: BOUNDS,
  origin: [-0.9718, 51.4589] as Position,
  minZoom: 11,
  maxZoom: 19,
  // Candidate extraction only; postcode districts do not establish in-box coordinates.
  ppdOutcodes: [
    "RG1",
    "RG2",
    "RG4",
    "RG5",
    "RG6",
    "RG7",
    "RG8",
    "RG10",
    "RG30",
    "RG31",
    "RG40",
    "RG41",
  ],
  initialView: {
    center: [-0.9718, 51.4589] as Position,
    zoom: 15.5,
    pitch: 58,
    bearing: -24,
  },
};
