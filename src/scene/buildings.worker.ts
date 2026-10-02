/// <reference lib="webworker" />
import { loadChunk } from "../map/repository";
import { buildGeometry } from "./geometry";

export interface MeshPacket {
  positions: Float32Array;
  colours: Float32Array;
  normals: Float32Array;
  ids: string[];
}
export interface ChunkResult {
  id: string;
  meshes?: MeshPacket[];
  ids?: string[];
  bytes?: number;
  error?: string;
  cancelled?: boolean;
}
const scope = self as unknown as DedicatedWorkerGlobalScope;
const tasks = new Map<string, AbortController>();
scope.onmessage = async ({
  data,
}: MessageEvent<{
  id: string;
  url?: string;
  sha256?: string;
  cancel?: boolean;
}>) => {
  if (data.cancel) {
    tasks.get(data.id)?.abort();
    return;
  }
  const controller = new AbortController();
  tasks.set(data.id, controller);
  try {
    const rows = await loadChunk(data.url!, data.sha256!, controller.signal);
    if (controller.signal.aborted)
      throw new DOMException("Cancelled", "AbortError");
    const geometry = buildGeometry(rows);
    const meshes: MeshPacket[] = Object.values(geometry).map((g) => ({
      positions: g.getAttribute("position").array as Float32Array,
      colours: g.getAttribute("color").array as Float32Array,
      normals: g.getAttribute("normal").array as Float32Array,
      ids: g.userData.buildingIds as string[],
    }));
    const bytes = meshes.reduce(
      (n, m) =>
        n +
        m.positions.byteLength +
        m.colours.byteLength +
        m.normals.byteLength +
        m.ids.length * 16,
      0,
    );
    scope.postMessage(
      {
        id: data.id,
        meshes,
        ids: rows.map((b) => b.id),
        bytes,
      } satisfies ChunkResult,
      meshes.flatMap((m) => [
        m.positions.buffer,
        m.colours.buffer,
        m.normals.buffer,
      ]) as ArrayBuffer[],
    );
    Object.values(geometry).forEach((g) => g.dispose());
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : "Building chunk failed",
      cancelled: controller.signal.aborted,
    } satisfies ChunkResult);
  } finally {
    tasks.delete(data.id);
  }
};
