import { z } from "zod";
import { salesSnapshotSchema, type SalesSnapshot } from "../../shared/sales";

export const DOWNLOADS_PAGE =
  "https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads";
export const TERMS_PAGE =
  "https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads#using-or-publishing-our-price-paid-data";
const officialHost = "price-paid-data.publicdata.landregistry.gov.uk";

// No arbitrary URL/proxy, credentials, redirects or third-party mirrors.
export function officialCsvUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== officialHost ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/pp-(?:complete|\d{4}|monthly-update-new-version)\.csv$/.test(
      url.pathname,
    )
  ) {
    throw new Error(
      "Use the HTTPS Price Paid CSV link on the official download page; this host/path is not supported.",
    );
  }
  return url.href;
}
export const releaseSchema = z
  .object({
    url: z.string().transform(officialCsvUrl),
    sourceDate: z.iso.date(),
    kind: z.enum(["annual", "complete", "monthly"]),
    year: z.number().int().min(1995).max(2100).optional(),
  })
  .superRefine((release, ctx) => {
    const expected =
      release.kind === "annual"
        ? `/pp-${release.year}.csv`
        : release.kind === "complete"
          ? "/pp-complete.csv"
          : "/pp-monthly-update-new-version.csv";
    if (
      new URL(release.url).pathname !== expected ||
      (release.kind !== "annual" && release.year !== undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "Release kind/year must agree with the official CSV filename",
      });
    if (
      release.year !== undefined &&
      release.year > Number(release.sourceDate.slice(0, 4))
    )
      ctx.addIssue({
        code: "custom",
        message: "Release year cannot follow the publisher date",
      });
  });
export type Release = z.infer<typeof releaseSchema>;
export const receiptSchema = z.object({
  version: z.literal(1),
  release: releaseSchema,
  retrievedAt: z.iso.datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  downloadsPage: z.literal(DOWNLOADS_PAGE),
  termsPage: z.literal(TERMS_PAGE),
  attribution: z.string().min(1),
  baseline: releaseSchema,
});
export type Receipt = z.infer<typeof receiptSchema>;
export function verifyPrevious(
  snapshot: unknown,
  receipt: unknown,
): { snapshot: SalesSnapshot; receipt: Receipt } {
  const parsed = salesSnapshotSchema.parse(snapshot);
  const source = receiptSchema.parse(receipt);
  if (
    source.release.kind !== "monthly" &&
    source.baseline.url !== source.release.url
  )
    throw new Error("Baseline receipt does not match the release");
  if (
    source.baseline.kind === "monthly" ||
    parsed.sourceDate !== source.release.sourceDate ||
    parsed.appliedFiles.at(-1) !== source.sha256 ||
    parsed.provenance.url !== source.release.url ||
    parsed.provenance.quality === "fixture"
  )
    throw new Error("Previous snapshot and official receipt disagree");
  return { snapshot: parsed, receipt: source };
}
export function validateSequence(
  release: Release,
  previous?: { snapshot: SalesSnapshot; receipt: Receipt },
): void {
  if (release.kind === "monthly" && !previous)
    throw new Error(
      "A monthly file is a change set, not full history. Supply --previous with an official annual/complete baseline.",
    );
  if (release.kind !== "monthly" && previous)
    throw new Error(
      "Annual/complete snapshots must start a new dataset; do not merge them as monthly changes.",
    );
  if (previous && release.sourceDate <= previous.snapshot.sourceDate)
    throw new Error(
      "The new publisher release date must follow the previous snapshot.",
    );
}
export function coverageAudit(snapshot: SalesSnapshot, receipt: Receipt) {
  const dates = snapshot.records.map((record) => record.date).sort();
  const byType: Record<string, number> = {},
    byCategory: Record<string, number> = {};
  for (const record of snapshot.records) {
    byType[record.type] = (byType[record.type] ?? 0) + 1;
    byCategory[record.category] = (byCategory[record.category] ?? 0) + 1;
  }
  return {
    source: receipt,
    input: snapshot.importAudit,
    candidates: snapshot.records.length,
    inBoundsWithDocumentedCoordinates: snapshot.matches.length,
    outsideBoundsWithDocumentedCoordinates: snapshot.outsideCoverage.length,
    unmatched: snapshot.unmatchedCount,
    observedSaleDateRange: dates.length ? [dates[0], dates.at(-1)] : null,
    byType,
    byCategory,
    candidateOutcodes: snapshot.candidateOutcodes,
    mapBounds: snapshot.bounds,
    limitations: [
      "Postcode candidates are not exact map coverage. Missing postcodes cannot be selected.",
      "No coordinates, UPRNs, dwelling-to-building joins or valuations are inferred.",
      "Monthly files contain registrations, corrections and deletions across sale dates; they are not sales for one month.",
      "An annual baseline is partial history. Later monthly changes do not make it a complete historical dataset.",
      "PPD excludes some transfers and records may be registered late or revised. Counts are not the entire market.",
      "A checksum identifies bytes; it is not a publisher signature. Publisher date is supplied by the operator.",
    ],
  };
}
