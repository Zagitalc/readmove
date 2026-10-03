import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { REGION } from "../../shared/config";
import { ingestPpd } from "../../scripts/property/ppd";
import {
  coverageAudit,
  DOWNLOADS_PAGE,
  TERMS_PAGE,
  officialCsvUrl,
  receiptSchema,
  releaseSchema,
  validateSequence,
  verifyPrevious,
} from "../../scripts/property/official-source";

const url =
  "https://price-paid-data.publicdata.landregistry.gov.uk/pp-2025.csv";
const annual = releaseSchema.parse({
  url,
  kind: "annual",
  year: 2025,
  sourceDate: "2026-09-01",
});
const monthly = releaseSchema.parse({
  url: url.replace("2025", "monthly-update-new-version"),
  kind: "monthly",
  sourceDate: "2026-10-01",
});
// Entirely synthetic test row: never publish as an official observation.
const row =
  '"{00000000-0000-0000-0000-000000000001}","400000","2025-03-04 00:00","RG1 1AA","T","N","F","10","","TEST STREET","","READING","READING","BERKSHIRE","A","A"';
const provenance = {
  source: "Synthetic importer test",
  date: annual.sourceDate,
  license: "CC0",
  quality: "mapped" as const,
  url,
};
async function fixture() {
  const snapshot = await ingestPpd(Readable.from([row]), {
    sourceDate: annual.sourceDate,
    bounds: REGION.bounds,
    outcodes: REGION.ppdOutcodes,
    provenance,
  });
  const receipt = receiptSchema.parse({
    version: 1,
    release: annual,
    baseline: annual,
    retrievedAt: "2026-10-02T00:00:00.000Z",
    sha256: snapshot.appliedFiles[0],
    bytes: Buffer.byteLength(row),
    downloadsPage: DOWNLOADS_PAGE,
    termsPage: TERMS_PAGE,
    attribution: "Synthetic test only",
  });
  return { snapshot, receipt };
}
describe("official source boundaries", () => {
  it("accepts only supported official HTTPS CSV URLs", () => {
    expect(officialCsvUrl(url)).toBe(url);
    for (const bad of [
      url.replace("https:", "http:"),
      url.replace(".gov.uk", ".gov.uk.example.com"),
      url.replace("https://", "https://user:password@"),
      `${url}?redirect=1`,
      `${url}#fragment`,
      url.replace("pp-2025.csv", "other.csv"),
      url.replace(".csv", ".csv/../secret"),
    ])
      expect(() => officialCsvUrl(bad)).toThrow();
  });
  it("validates declared source scope against its filename and publisher date", () => {
    expect(() => releaseSchema.parse({ ...annual, year: 2024 })).toThrow();
    expect(() =>
      releaseSchema.parse({ ...annual, kind: "complete" }),
    ).toThrow();
    expect(() =>
      releaseSchema.parse({ ...annual, sourceDate: "2024-09-01" }),
    ).toThrow();
    expect(() => releaseSchema.parse({ ...monthly, year: 2025 })).toThrow();
  });
  it("requires a consistent download receipt and chronological baseline for monthly changes", async () => {
    const previous = await fixture();
    expect(() => validateSequence(monthly)).toThrow("change set");
    expect(() => validateSequence(annual, previous)).toThrow("new dataset");
    expect(() => validateSequence(monthly, previous)).not.toThrow();
    expect(() =>
      validateSequence({ ...monthly, sourceDate: annual.sourceDate }, previous),
    ).toThrow("follow");
    expect(verifyPrevious(previous.snapshot, previous.receipt)).toEqual(
      previous,
    );
    expect(() =>
      verifyPrevious(previous.snapshot, {
        ...previous.receipt,
        sha256: "0".repeat(64),
      }),
    ).toThrow("disagree");
    expect(() =>
      verifyPrevious(
        {
          ...previous.snapshot,
          provenance: { ...provenance, quality: "fixture" },
        },
        previous.receipt,
      ),
    ).toThrow("disagree");
  });
  it("keeps unmatched official-source candidates off the map and reports partial coverage", async () => {
    const { snapshot, receipt } = await fixture();
    const audit = coverageAudit(snapshot, receipt);
    expect(audit.candidates).toBe(1);
    expect(audit.inBoundsWithDocumentedCoordinates).toBe(0);
    expect(audit.unmatched).toBe(1);
    expect(audit.observedSaleDateRange).toEqual(["2025-03-04", "2025-03-04"]);
    expect(audit.byType).toEqual({ terraced: 1 });
    expect(audit.byCategory).toEqual({ A: 1 });
    expect(audit.source.baseline.kind).toBe("annual");
    expect(snapshot.records[0]).not.toHaveProperty("position");
    expect(snapshot.records[0].provenance.url).toBe(url);
  });
});
