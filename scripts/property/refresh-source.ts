import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
export interface Source {
  url: string;
  sha256: string;
  bytes: number;
  retrievedOn: string;
  lastModified: string;
  localFile?: string;
}
export async function checksum(path: string) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}
export async function verifyFile(
  path: string,
  source: Pick<Source, "sha256" | "bytes">,
) {
  const actual = await checksum(path);
  if (actual.sha256 !== source.sha256 || actual.bytes !== source.bytes)
    throw new Error(`Source checksum/length mismatch: ${path}`);
}
/** Local/cache bytes are rehashed on every run. Failed downloads never become cached sources. */
export async function acquire(
  source: Source,
  root: string,
  cache: string,
  offline: boolean,
) {
  if (source.localFile) {
    const path = resolve(root, source.localFile);
    try {
      await verifyFile(path, source);
      return {
        path,
        retrievedOn: source.retrievedOn,
        lastModified: source.lastModified,
        acquisition: "reviewed-local",
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  await mkdir(cache, { recursive: true });
  const path = join(cache, source.sha256);
  try {
    const receipt = JSON.parse(await readFile(path + ".json", "utf8"));
    if (
      receipt.url !== source.url ||
      receipt.sha256 !== source.sha256 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(receipt.retrievedOn) ||
      typeof receipt.lastModified !== "string"
    )
      throw new Error("Invalid cache receipt");
    await verifyFile(path, source);
    return {
      path,
      retrievedOn: receipt.retrievedOn as string,
      lastModified: receipt.lastModified as string,
      acquisition: "cache",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (offline) throw new Error(`Offline source missing: ${source.url}`);
  const temp = path + ".partial-" + randomUUID();
  try {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });
    if (!response.ok || !response.body)
      throw new Error(`Source HTTP ${response.status}: ${source.url}`);
    let bytes = 0;
    async function* bounded() {
      for await (const chunk of Readable.fromWeb(response.body! as never)) {
        bytes += chunk.length;
        if (bytes > source.bytes)
          throw new Error("Download exceeds reviewed source size");
        yield chunk;
      }
    }
    await pipeline(
      Readable.from(bounded()),
      createWriteStream(temp, { flags: "wx" }),
    );
    await verifyFile(temp, source);
    const receipt = {
      url: source.url,
      sha256: source.sha256,
      retrievedOn: new Date().toISOString().slice(0, 10),
      lastModified:
        response.headers.get("last-modified") || "Not supplied by publisher",
    };
    await rename(temp, path);
    await writeFile(path + ".json", JSON.stringify(receipt) + "\n");
    return { path, ...receipt, acquisition: "download" };
  } finally {
    await rm(temp, { force: true });
  }
}
