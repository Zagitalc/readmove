import {
  verifiedLocationsSchema,
  type VerifiedLocations,
} from "../../shared/verified-locations";
import { inBounds } from "../../shared/geo";
import { REGION } from "../../shared/config";
export function coverage(data: VerifiedLocations) {
  const points = new Map(data.coordinates.map((c) => [c.uprn, c.position]));
  const inside = data.identifiers.filter((i) =>
    inBounds(points.get(i.uprn), REGION.bounds),
  );
  return {
    ...data.counts,
    inBounds: inside.length,
    distinctInBoundsUprns: new Set(inside.map((i) => i.uprn)).size,
    distinctInBoundsPositions: new Set(
      inside.map((i) => points.get(i.uprn)!.join(",")),
    ).size,
  };
}
export function compareCoverage(
  before: VerifiedLocations,
  after: VerifiedLocations,
) {
  verifiedLocationsSchema.parse(before);
  verifiedLocationsSchema.parse(after);
  if (before.salesAssetSha256 !== after.salesAssetSha256)
    throw new Error(
      "Coverage comparison requires the same reviewed sales snapshot",
    );
  const old = new Map(before.identifiers.map((i) => [i.transactionId, i]));
  const next = new Map(after.identifiers.map((i) => [i.transactionId, i]));
  const oldPoints = new Map(
    before.coordinates.map((c) => [c.uprn, c.position]),
  );
  const newPoints = new Map(after.coordinates.map((c) => [c.uprn, c.position]));
  const mapped = (data: VerifiedLocations) =>
    new Set(
      data.identifiers
        .filter((i) =>
          data.coordinates.some(
            (c) => c.uprn === i.uprn && inBounds(c.position, REGION.bounds),
          ),
        )
        .map((i) => i.transactionId),
    );
  const priorMapped = mapped(before),
    nextMapped = mapped(after);
  const changes = {
    addedIdentifiers: [...next.keys()].filter((id) => !old.has(id)),
    removedIdentifiers: [...old.keys()].filter((id) => !next.has(id)),
    changedIdentifiers: [...next.values()].filter(
      (i) =>
        old.has(i.transactionId) && old.get(i.transactionId)!.uprn !== i.uprn,
    ),
    addedInBounds: [...nextMapped].filter((id) => !priorMapped.has(id)),
    removedInBounds: [...priorMapped].filter((id) => !nextMapped.has(id)),
    changedCoordinates: [...newPoints]
      .filter(
        ([uprn, p]) =>
          oldPoints.has(uprn) &&
          JSON.stringify(oldPoints.get(uprn)) !== JSON.stringify(p),
      )
      .map(([uprn]) => uprn),
    removedSources: before.sources
      .filter((s) => !after.sources.some((n) => n.sha256 === s.sha256))
      .map((s) => s.sha256),
  };
  return {
    before: coverage(before),
    after: coverage(after),
    changes,
    ambiguousIdentifiers: after.ambiguous,
    ambiguousCoordinates: after.coordinateSource.ambiguousUprns,
    reviewRequired: true,
    warnings: [
      ...(changes.removedIdentifiers.length || changes.removedInBounds.length
        ? ["Coverage decreased; inspect losses before publication."]
        : []),
      ...(changes.removedSources.length
        ? [
            "Previously used lookup releases were omitted. Monthly files are not a complete archive.",
          ]
        : []),
      ...(after.ambiguous.length || after.coordinateSource.ambiguousUprns.length
        ? [
            "Conflicting mappings/coordinates are excluded, never resolved by release order.",
          ]
        : []),
    ],
  };
}
