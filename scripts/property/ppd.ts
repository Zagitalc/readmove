import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { z } from "zod";
import { inBounds } from "../../shared/geo";
import type { Bounds, Provenance, Transaction } from "../../shared/types";
import {
  landRegistryRecordSchema,
  saleMatchSchema,
  salesSnapshotSchema,
  type LandRegistryRecord,
  type SaleMatch,
  type SalesSnapshot,
} from "../../shared/sales";

const typeMap: Record<string, Transaction["type"]> = {
  D: "detached",
  S: "semi-detached",
  T: "terraced",
  F: "flat",
  O: "other",
};
const idSchema = z
  .string()
  .regex(/^\{[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}\}$/);
export interface Change {
  id: string;
  action: "A" | "C" | "D";
  record?: LandRegistryRecord;
}
export function parsePpdRow(row: string[], provenance: Provenance): Change {
  if (row.length !== 16)
    throw new Error(
      `Expected 16 Price Paid Data columns, received ${row.length}`,
    );
  const [
    id,
    price,
    timestamp,
    postcode,
    type,
    newBuild,
    tenure,
    paon,
    saon,
    street,
    locality,
    town,
    district,
    county,
    category,
    action,
  ] = row;
  idSchema.parse(id);
  if (!["A", "C", "D"].includes(action))
    throw new Error(`Unknown PPD change action: ${action}`);
  if (action === "D") return { id: id.toUpperCase(), action };
  if (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)))
    throw new Error("Invalid sale price");
  if (!/^\d{4}-\d{2}-\d{2}(?: 00:00(?::00)?)?$/.test(timestamp))
    throw new Error("Invalid PPD transaction timestamp");
  if (
    !typeMap[type] ||
    !["Y", "N"].includes(newBuild) ||
    !["F", "L", "U"].includes(tenure)
  )
    throw new Error("Invalid property type, new-build flag or tenure");
  const record = landRegistryRecordSchema.parse({
    id: id.toUpperCase(),
    price: Number(price),
    date: timestamp.slice(0, 10),
    type: typeMap[type],
    newBuild: newBuild === "Y",
    tenure:
      tenure === "F" ? "freehold" : tenure === "L" ? "leasehold" : "unknown",
    address: {
      postcode: postcode.trim().toUpperCase().replace(/\s+/g, " "),
      paon,
      saon,
      street,
      locality,
      town,
      district,
      county,
    },
    category,
    provenance,
  });
  return { id: record.id, action: action as "A" | "C", record };
}
export function applyPpdChange(
  records: Map<string, LandRegistryRecord>,
  change: Change,
  outcodes: string[],
): void {
  if (change.action === "D") {
    records.delete(change.id);
    return;
  }
  const record = change.record!;
  const candidate = outcodes.includes(record.address.postcode.split(" ")[0]);
  // A correction that moves outside the candidate region must remove the old record.
  if (!candidate) {
    records.delete(change.id);
    return;
  }
  records.set(change.id, record);
}
export async function ingestPpd(
  input: AsyncIterable<Buffer | string>,
  options: {
    sourceDate: string;
    bounds: Bounds;
    outcodes: string[];
    previous?: unknown;
    links?: unknown;
  },
): Promise<SalesSnapshot> {
  z.iso.date().parse(options.sourceDate);
  const previous = options.previous
    ? salesSnapshotSchema.parse(options.previous)
    : undefined;
  if (
    previous &&
    (JSON.stringify(previous.bounds) !== JSON.stringify(options.bounds) ||
      JSON.stringify(previous.candidateOutcodes) !==
        JSON.stringify(options.outcodes))
  )
    throw new Error(
      "Previous snapshot coverage differs; rebuild it explicitly",
    );
  const provenance: Provenance = {
    source: "HM Land Registry Price Paid Data · user-supplied file",
    date: options.sourceDate,
    license: "OGL v3.0",
    quality: "mapped",
    url: "https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads",
  };
  const records = new Map(previous?.records.map((r) => [r.id, r]) ?? []);
  const hash = createHash("sha256");
  async function* hashed() {
    for await (const chunk of input) {
      hash.update(chunk);
      yield chunk;
    }
  }
  const source = Readable.from(hashed());
  const parser = parse({
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 100000,
  });
  source.on("error", (error) => parser.destroy(error));
  parser.on("close", () => source.destroy());
  source.pipe(parser);
  const changedAddress = new Set<string>();
  let rowNumber = 0;
  for await (const row of parser) {
    rowNumber++;
    try {
      const change = parsePpdRow(row as string[], provenance);
      const old = records.get(change.id);
      if (
        old &&
        change.record &&
        JSON.stringify(old.address) !== JSON.stringify(change.record.address)
      )
        changedAddress.add(change.id);
      applyPpdChange(records, change, options.outcodes);
    } catch (error) {
      throw new Error(
        `PPD row ${rowNumber}: ${error instanceof Error ? error.message : "Invalid record"}`,
      );
    }
  }
  if (!rowNumber) throw new Error("Empty PPD input");
  const digest = hash.digest("hex");
  const reapplied = previous?.appliedFiles.includes(digest);
  if (reapplied && options.links === undefined) return previous!;
  if (reapplied) {
    records.clear();
    previous!.records.forEach((record) => records.set(record.id, record));
    changedAddress.clear();
  }
  if (!reapplied && previous && options.sourceDate <= previous.sourceDate)
    throw new Error(
      "Incremental source date must follow the previous snapshot; apply updates in order",
    );
  const supplied =
    options.links === undefined
      ? [...(previous?.matches ?? []), ...(previous?.outsideCoverage ?? [])]
      : z.array(saleMatchSchema).parse(options.links);
  const seen = new Set<string>(),
    matches: SaleMatch[] = [],
    outsideCoverage: SaleMatch[] = [];
  for (const link of supplied) {
    const id = link.transactionId.toUpperCase();
    if (seen.has(id))
      throw new Error("Duplicate geographic link for a transaction");
    seen.add(id);
    if (!records.has(id)) continue; // Correction/deletion removes obsolete links.
    if (
      changedAddress.has(id) &&
      (options.links === undefined || link.matchedOn < options.sourceDate)
    )
      continue;
    const normalized = { ...link, transactionId: id };
    if (inBounds(link.position, options.bounds)) matches.push(normalized);
    else outsideCoverage.push(normalized);
  }
  return {
    version: 1,
    sourceDate: reapplied ? previous!.sourceDate : options.sourceDate,
    candidateOutcodes: options.outcodes,
    bounds: options.bounds,
    provenance: reapplied ? previous!.provenance : provenance,
    appliedFiles: reapplied
      ? previous!.appliedFiles
      : [...(previous?.appliedFiles ?? []), digest],
    records: [...records.values()].sort((a, b) => a.id.localeCompare(b.id)),
    matches,
    outsideCoverage,
    unmatchedCount: records.size - matches.length - outsideCoverage.length,
  };
}
