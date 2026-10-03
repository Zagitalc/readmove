import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { transactionIdSchema, uprnSchema } from "../../shared/sale-locations";

/** Retain only relevant IDs, but validate every publisher row. Conflicts never pick a winner. */
export async function joinUprnLookup(
  input: AsyncIterable<Buffer | string>,
  saleIds: Set<string>,
) {
  const matches = new Map<string, Set<string>>();
  const hash = createHash("sha256");
  let bytes = 0,
    rows = 0,
    duplicateRows = 0;
  async function* chunks() {
    for await (const chunk of input) {
      hash.update(chunk);
      bytes +=
        typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      yield chunk;
    }
  }
  const source = Readable.from(chunks());
  const parser = parse({
    bom: true,
    skip_empty_lines: true,
    max_record_size: 1000,
  });
  source.on("error", (error) => parser.destroy(error));
  parser.on("close", () => source.destroy());
  source.pipe(parser);
  for await (const row of parser) {
    rows++;
    try {
      if (row.length !== 2)
        throw new Error("Expected transaction ID and UPRN columns");
      const id = transactionIdSchema.parse(String(row[0]).toUpperCase());
      const uprn = uprnSchema.parse(row[1]);
      if (!saleIds.has(id)) continue;
      const existing = matches.get(id) ?? new Set<string>();
      if (existing.has(uprn)) duplicateRows++;
      existing.add(uprn);
      matches.set(id, existing);
    } catch (error) {
      throw new Error(
        `UPRN lookup row ${rows}: ${error instanceof Error ? error.message : "Invalid row"}`,
      );
    }
  }
  if (!rows) throw new Error("Empty UPRN lookup");
  const identifiers: { transactionId: string; uprn: string }[] = [];
  const ambiguous: { transactionId: string; uprns: string[] }[] = [];
  for (const [transactionId, values] of matches) {
    const uprns = [...values].sort();
    if (uprns.length === 1) identifiers.push({ transactionId, uprn: uprns[0] });
    else ambiguous.push({ transactionId, uprns });
  }
  identifiers.sort((a, b) => a.transactionId.localeCompare(b.transactionId));
  ambiguous.sort((a, b) => a.transactionId.localeCompare(b.transactionId));
  return {
    identifiers,
    ambiguous,
    rows,
    duplicateRows,
    sha256: hash.digest("hex"),
    bytes,
    unmatched: saleIds.size - identifiers.length - ambiguous.length,
  };
}
