import type { joinUprnLookup } from "./uprn";
type Lookup = Awaited<ReturnType<typeof joinUprnLookup>>;
/** Retain evidence even for conflicts within a release; no later release wins. */
export function mergeUprnLookups(releases: Lookup[], saleIds: Set<string>) {
  const candidates = new Map<string, Map<string, Set<string>>>();
  for (const release of releases) {
    for (const pair of [
      ...release.identifiers,
      ...release.ambiguous.flatMap((a) =>
        a.uprns.map((uprn) => ({ transactionId: a.transactionId, uprn })),
      ),
    ]) {
      if (!saleIds.has(pair.transactionId))
        throw new Error("Unexpected transaction ID");
      const values =
        candidates.get(pair.transactionId) ?? new Map<string, Set<string>>();
      const evidence = values.get(pair.uprn) ?? new Set<string>();
      evidence.add(release.sha256);
      values.set(pair.uprn, evidence);
      candidates.set(pair.transactionId, values);
    }
  }
  const identifiers: {
    transactionId: string;
    uprn: string;
    sourceHashes: string[];
  }[] = [];
  const ambiguous: {
    transactionId: string;
    mappings: { uprn: string; sourceHashes: string[] }[];
  }[] = [];
  for (const [transactionId, values] of [...candidates].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const mappings = [...values]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([uprn, hashes]) => ({ uprn, sourceHashes: [...hashes].sort() }));
    if (mappings.length === 1)
      identifiers.push({ transactionId, ...mappings[0] });
    else ambiguous.push({ transactionId, mappings });
  }
  return { identifiers, ambiguous, unmatched: saleIds.size - candidates.size };
}
