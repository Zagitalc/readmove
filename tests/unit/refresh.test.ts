import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { acquire } from "../../scripts/property/refresh-source";
import { refreshPlanSchema } from "../../scripts/property/refresh-plan";
import { compareCoverage } from "../../scripts/property/refresh-report";
import { verifiedLocationsSchema } from "../../shared/verified-locations";
const hash = (text: Buffer | string) =>
  createHash("sha256").update(text).digest("hex");
const dirs: string[] = [];
async function temp() {
  const d = await mkdtemp(join(tmpdir(), "readmove-refresh-"));
  dirs.push(d);
  return d;
}
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
const source = {
  url: "https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-jul-2026.csv",
  sha256: hash("abc"),
  bytes: 3,
  retrievedOn: "2026-10-03",
  lastModified: "reviewed",
};
it("rejects corrupt local bytes instead of silently redownloading", async () => {
  const root = await temp();
  await writeFile(join(root, "source"), "bad");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    acquire(
      { ...source, localFile: "source" },
      root,
      join(root, "cache"),
      false,
    ),
  ).rejects.toThrow("checksum");
  expect(fetch).not.toHaveBeenCalled();
});
it("downloads verified bytes, preserves retrieval evidence and rehashes offline cache", async () => {
  const root = await temp();
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("abc", { headers: { "last-modified": "publisher-date" } }),
    );
  vi.stubGlobal("fetch", fetch);
  const first = await acquire(source, root, root, false);
  expect(first.lastModified).toBe("publisher-date");
  const second = await acquire(source, root, root, true);
  expect(second.retrievedOn).toBe(first.retrievedOn);
  expect(fetch).toHaveBeenCalledTimes(1);
  await writeFile(second.path, "bad");
  await expect(acquire(source, root, root, true)).rejects.toThrow("checksum");
});
it.each([
  new Response("bad"),
  new Response("toolong"),
  new Response("no", { status: 403 }),
])("does not cache failed or changed downloads", async (response) => {
  const root = await temp();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(acquire(source, root, root, false)).rejects.toThrow();
  expect(await readdir(root)).toEqual([]);
});
it("offline missing sources never request the network", async () => {
  const root = await temp();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(acquire(source, root, root, true)).rejects.toThrow("Offline");
  expect(fetch).not.toHaveBeenCalled();
});
const plan = () =>
  JSON.parse(readFileSync("config/property-refresh.json", "utf8"));
it("rejects duplicate releases, mismatched periods and snapshot chronology", () => {
  const p = plan();
  expect(refreshPlanSchema.safeParse(p).success).toBe(true);
  p.lookups.push(p.lookups[0]);
  expect(refreshPlanSchema.safeParse(p).success).toBe(false);
  const q = plan();
  q.lookups[0].period = "2026-09";
  expect(refreshPlanSchema.safeParse(q).success).toBe(false);
  const r = plan();
  r.coordinates.snapshotDate = "2026-10-01";
  expect(refreshPlanSchema.safeParse(r).success).toBe(false);
});
it("reports exact losses and distinguishes transactions, UPRNs and coordinate positions", () => {
  const a = verifiedLocationsSchema.parse(
    JSON.parse(readFileSync("public/data/sale-locations.v2.json", "utf8")),
  );
  const same = compareCoverage(a, a);
  expect(same.after.inBounds).toBe(177);
  expect(same.after.distinctInBoundsUprns).toBe(176);
  expect(same.after.distinctInBoundsPositions).toBe(160);
  const b = structuredClone(a);
  const removed = b.identifiers.shift()!;
  b.coordinates = b.coordinates.filter((c) =>
    b.identifiers.some((i) => i.uprn === c.uprn),
  );
  b.counts.identifierMatches--;
  b.counts.unmatchedIdentifiers++;
  b.counts.coordinateMatches = b.identifiers.filter((i) =>
    b.coordinates.some((c) => c.uprn === i.uprn),
  ).length;
  b.counts.outsideMapBounds = b.identifiers.filter((i) => {
    const p = b.coordinates.find((c) => c.uprn === i.uprn)?.position;
    return (
      p && !(p[0] >= -1.08 && p[0] <= -0.84 && p[1] >= 51.39 && p[1] <= 51.5)
    );
  }).length;
  expect(compareCoverage(a, b).changes.removedIdentifiers).toEqual([
    removed.transactionId,
  ]);
  b.salesAssetSha256 = "0".repeat(64);
  expect(() => compareCoverage(a, b)).toThrow("same reviewed sales");
});
it("end-to-end fixture refresh excludes conflicts, refuses reuse and publishes no candidate on extraction failure", async () => {
  // Synthetic source bytes for pipeline testing only; never published as official observations.
  const root = await temp();
  const p = plan();
  const sales = JSON.parse(readFileSync(p.sales.path, "utf8"));
  const [a, b] = sales.records;
  const csvs = [`${a.id},123\n${b.id},456\n`, `${a.id},123\n${b.id},789\n`];
  for (let i = 0; i < 2; i++) {
    const path = join(root, `lookup${i}.csv`);
    await writeFile(path, csvs[i]);
    Object.assign(p.lookups[i], {
      localFile: path,
      sha256: hash(csvs[i]),
      bytes: Buffer.byteLength(csvs[i]),
      rows: 2,
    });
  }
  const csv =
    "UPRN,X_COORDINATE,Y_COORDINATE,LATITUDE,LONGITUDE\n123,470000,173000,51.45,-0.97\n456,470000,173000,51.46,-0.96\n";
  const zip = join(root, "fixture.zip");
  execFileSync("python3", [
    "-c",
    "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('fixture.csv',sys.argv[2]); z.writestr('versions.txt','Data Extraction Date: 14-08-2026'); z.close()",
    zip,
    csv,
  ]);
  const bytes = await readFile(zip);
  Object.assign(p.coordinates, {
    localFile: zip,
    sha256: hash(bytes),
    bytes: bytes.length,
    member: "fixture.csv",
    csvSha256: hash(csv),
    rows: 2,
  });
  const manifest = join(root, "plan.json");
  await writeFile(manifest, JSON.stringify(p));
  const run = "test-" + randomUUID();
  const output = resolve("raw/refresh", run);
  dirs.push(output);
  const args = [
    "--import",
    "tsx",
    "scripts/property/refresh.ts",
    "--manifest",
    manifest,
    "--run",
    run,
    "--offline",
  ];
  execFileSync(process.execPath, args, { stdio: "pipe" });
  const candidate = JSON.parse(
    await readFile(join(output, "sale-locations.v2.json"), "utf8"),
  );
  expect(candidate.identifiers).toHaveLength(1);
  expect(candidate.identifiers[0].sourceHashes).toHaveLength(2);
  expect(candidate.ambiguous).toHaveLength(1);
  expect(candidate.coordinates).toHaveLength(1);
  expect(candidate.coordinateSource.snapshotDate).toBe("2026-08-14");
  expect(candidate.coordinateSource.releasePeriod).toBe("2026-09");
  const original = await readFile(
    join(output, "sale-locations.v2.json"),
    "utf8",
  );
  expect(() =>
    execFileSync(process.execPath, args, { stdio: "pipe" }),
  ).toThrow();
  expect(await readFile(join(output, "sale-locations.v2.json"), "utf8")).toBe(
    original,
  );
  p.coordinates.csvSha256 = "0".repeat(64);
  await writeFile(manifest, JSON.stringify(p));
  const failrun = "test-" + randomUUID();
  const failed = resolve("raw/refresh", failrun);
  dirs.push(failed);
  expect(() =>
    execFileSync(
      process.execPath,
      args.map((v) => (v === run ? failrun : v)),
      { stdio: "pipe" },
    ),
  ).toThrow();
  expect(await readdir(failed)).toContain("FAILED.json");
  expect(await readdir(failed)).not.toContain("sale-locations.v2.json");
}, 20000);
