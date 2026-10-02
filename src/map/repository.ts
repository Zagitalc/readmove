import { z } from "zod";
import {
  buildingSchema,
  positionSchema,
  type Building,
  type Geography,
  type SearchBuilding,
} from "../../shared/types";

export async function fetchJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(`Local map data could not load (${response.status}).`);
  return response.json();
}
export async function loadChunk(
  url: string,
  sha256: string,
  signal?: AbortSignal,
): Promise<Building[]> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(`Building chunk unavailable (${response.status}).`);
  const data = await response.arrayBuffer();
  const actual = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== sha256)
    throw new Error(
      "Building chunk checksum mismatch. Reload after completing the data update.",
    );
  return z
    .array(buildingSchema)
    .parse(JSON.parse(new TextDecoder().decode(data)));
}
const searchSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string().optional(),
    address: z.string().optional(),
    kind: z.string(),
    position: positionSchema,
  }),
);

/** Small independent detail cache; scene geometry eviction cannot break the selected panel. */
export class BuildingRepository {
  private lookup?: Promise<Record<string, string>>;
  private search?: Promise<SearchBuilding[]>;
  private cache = new Map<string, Building[]>();
  private bootstrap: Map<string, Building>;
  constructor(private geography: Geography) {
    this.bootstrap = new Map(geography.buildings.map((b) => [b.id, b]));
  }
  getSearch(): Promise<SearchBuilding[]> {
    return (this.search ??= fetchJson(this.geography.searchUrl)
      .then((value) => searchSchema.parse(value))
      .catch((error) => {
        this.search = undefined;
        throw error;
      }));
  }
  async get(id: string): Promise<Building | undefined> {
    if (this.bootstrap.has(id)) return this.bootstrap.get(id);
    const lookup = await (this.lookup ??= fetchJson(this.geography.lookupUrl)
      .then((value) =>
        z.record(z.string(), z.string().regex(/^\d+_\d+$/)).parse(value),
      )
      .catch((error) => {
        this.lookup = undefined;
        throw error;
      }));
    const key = lookup[id];
    if (!key) return;
    const chunk = this.geography.chunks.find((c) => c.id === key);
    if (!chunk) throw new Error("Building index references an unknown chunk.");
    let rows = this.cache.get(key);
    if (!rows) rows = await loadChunk(chunk.url, chunk.sha256);
    this.cache.delete(key);
    this.cache.set(key, rows);
    while (this.cache.size > 6)
      this.cache.delete(this.cache.keys().next().value!);
    return rows.find((b) => b.id === id);
  }
}
