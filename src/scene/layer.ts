import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Camera,
  DirectionalLight,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from "maplibre-gl";
import { REGION } from "../../shared/config";
import { intersects } from "../../shared/geo";
import type { Bounds, Building, BuildingChunk } from "../../shared/types";
import { buildGeometry } from "./geometry";
import { chooseChunks, DETAIL_ZOOM } from "./chunks";
import type { ChunkResult } from "./buildings.worker";

export interface SceneStatus {
  resident: number;
  loading: number;
  failed: number;
  limited: boolean;
  overview: boolean;
  enabled: boolean;
  bytes: number;
  maxChunks: number;
  maxBytes: number;
}
export class BuildingLayer implements CustomLayerInterface {
  id = "buildings-3d";
  type = "custom" as const;
  renderingMode = "3d" as const;
  private scene = new Scene();
  private camera = new Camera();
  private renderer?: WebGLRenderer;
  private map?: MapLibreMap;
  private content = new Group();
  private highlight = new Group();
  private material = new MeshLambertMaterial({
    vertexColors: true,
    side: DoubleSide,
  });
  private enabled = true;
  private selected?: Building;
  private disposed = false;
  private resident = new Map<
    string,
    { group: Group; ids: string[]; bytes: number }
  >();
  private workers: Worker[] = [];
  private pending = new Map<string, Worker>();
  private wanted = new Map<string, BuildingChunk>();
  private failed = new Set<string>();
  private oversized = new Set<string>();
  private limited = false;
  private fallbackKey = "";
  private timer?: ReturnType<typeof setTimeout>;
  private maxChunks: number;
  private maxBuildings: number;
  private maxBytes: number;
  onStatus?: (status: SceneStatus) => void;
  constructor(
    private chunks: BuildingChunk[],
    mobile = false,
  ) {
    this.maxChunks = mobile ? 18 : 32;
    this.maxBuildings = mobile ? 2600 : 5000;
    this.maxBytes = (mobile ? 48 : 96) * 1024 * 1024;
  }
  onAdd(
    map: MapLibreMap,
    gl: WebGLRenderingContext | WebGL2RenderingContext,
  ): void {
    this.map = map;
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as WebGL2RenderingContext,
    });
    this.renderer.autoClear = false;
    const sun = new DirectionalLight(0xfff5e2, 2.1);
    sun.position.set(-600, -400, 1100);
    this.scene.add(
      new AmbientLight(0xffffff, 1.8),
      sun,
      this.content,
      this.highlight,
    );
    for (let i = 0; i < 2; i++) this.spawnWorker();
    map.on("move", this.onMove);
    map.on("moveend", this.update);
    this.update();
  }
  private spawnWorker(): void {
    const worker = new Worker(
      new URL("./buildings.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = ({ data }: MessageEvent<ChunkResult>) => {
      this.pending.delete(data.id);
      if (this.disposed) return;
      if (data.error && !data.cancelled) this.failed.add(data.id);
      if (
        this.wanted.has(data.id) &&
        data.meshes &&
        data.ids &&
        data.bytes != null
      ) {
        if (this.status().bytes + data.bytes > this.maxBytes)
          this.oversized.add(data.id);
        else {
          const group = new Group();
          for (const packet of data.meshes) {
            const geometry = new BufferGeometry();
            geometry.setAttribute(
              "position",
              new BufferAttribute(packet.positions, 3),
            );
            geometry.setAttribute(
              "color",
              new BufferAttribute(packet.colours, 3),
            );
            geometry.setAttribute(
              "normal",
              new BufferAttribute(packet.normals, 3),
            );
            geometry.userData.buildingIds = packet.ids;
            geometry.computeBoundingSphere();
            group.add(new Mesh(geometry, this.material));
          }
          this.resident.set(data.id, {
            group,
            ids: data.ids,
            bytes: data.bytes,
          });
          this.content.add(group);
        }
      }
      this.updateFallback();
      this.pump();
      this.map?.triggerRepaint();
    };
    worker.onerror = () => {
      for (const [id, assigned] of this.pending)
        if (assigned === worker) {
          this.pending.delete(id);
          this.failed.add(id);
        }
      worker.terminate();
      this.workers = this.workers.filter((w) => w !== worker);
      // Stop this slot on a worker-level failure; explicit retry creates replacements.
      this.pump();
      this.emit();
    };
    this.workers.push(worker);
  }
  private onMove = (): void => {
    if (this.map && this.map.getZoom() < DETAIL_ZOOM) {
      this.update();
      return;
    }
    if (!this.timer)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.update();
      }, 150);
  };
  private update = (): void => {
    if (!this.map || this.disposed) return;
    const b = this.map.getBounds(),
      centre = this.map.getCenter();
    const bounds: Bounds = [
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ];
    const eligible = this.enabled && this.map.getZoom() >= DETAIL_ZOOM;
    const desired = eligible
      ? chooseChunks(
          this.chunks,
          bounds,
          [centre.lng, centre.lat],
          this.maxChunks,
          this.maxBuildings,
        )
      : [];
    this.wanted = new Map(desired.map((c) => [c.id, c]));
    this.limited =
      eligible &&
      this.chunks.filter((c) => intersects(c.bounds, bounds)).length >
        desired.length;
    for (const [id, entry] of this.resident)
      if (!this.wanted.has(id)) {
        this.content.remove(entry.group);
        this.disposeGroup(entry.group);
        this.resident.delete(id);
      }
    for (const [id, worker] of this.pending)
      if (!this.wanted.has(id)) worker.postMessage({ id, cancel: true });
    // Oversized candidates can be attempted again after moving to a different working set.
    for (const id of this.oversized)
      if (!this.wanted.has(id)) this.oversized.delete(id);
    this.updateFallback();
    this.pump();
    this.map.triggerRepaint();
  };
  private pump(): void {
    if (this.disposed) return;
    for (const worker of this.workers) {
      if ([...this.pending.values()].includes(worker)) continue;
      const candidate = [...this.wanted.values()].find(
        (c) =>
          !this.resident.has(c.id) &&
          !this.pending.has(c.id) &&
          !this.failed.has(c.id) &&
          !this.oversized.has(c.id),
      );
      if (!candidate) continue;
      this.pending.set(candidate.id, worker);
      worker.postMessage(candidate);
    }
    this.emit();
  }
  private updateFallback(): void {
    if (!this.map?.getLayer("building-overview")) return;
    const key = [...this.resident.keys()].sort().join(",");
    if (key === this.fallbackKey) return;
    this.fallbackKey = key;
    // Keep coarse vector extrusions until each precise chunk is ready, including capped/failed chunks.
    const loaded = [...this.resident.values()].flatMap((entry) => entry.ids);
    this.map.setFilter("building-overview", [
      "all",
      ["==", ["get", "kind"], "building"],
      ["!", ["in", ["get", "id"], ["literal", loaded]]],
    ]);
  }
  status(): SceneStatus {
    return {
      resident: this.resident.size,
      loading: this.pending.size,
      failed: [...this.failed].filter((id) => this.wanted.has(id)).length,
      limited:
        this.limited || [...this.oversized].some((id) => this.wanted.has(id)),
      overview: !this.map || this.map.getZoom() < DETAIL_ZOOM,
      enabled: this.enabled,
      bytes: [...this.resident.values()].reduce((n, e) => n + e.bytes, 0),
      maxChunks: this.maxChunks,
      maxBytes: this.maxBytes,
    };
  }
  private emit(): void {
    this.onStatus?.(this.status());
  }
  retry(): void {
    this.failed.clear();
    this.oversized.clear();
    while (this.workers.length < 2) this.spawnWorker();
    this.update();
  }
  render(
    _gl: WebGLRenderingContext | WebGL2RenderingContext,
    args: CustomRenderMethodInput,
  ): void {
    if (!this.renderer || !this.map) return;
    const origin = MercatorCoordinate.fromLngLat(REGION.origin),
      scale = origin.meterInMercatorCoordinateUnits();
    const model = new Matrix4()
      .makeTranslation(origin.x, origin.y, 0)
      .scale(new Vector3(scale, -scale, scale));
    this.camera.projectionMatrix
      .fromArray(args.defaultProjectionData.mainMatrix)
      .multiply(model);
    this.camera.projectionMatrixInverse
      .copy(this.camera.projectionMatrix)
      .invert();
    this.content.visible = this.enabled && this.map.getZoom() >= DETAIL_ZOOM;
    this.highlight.visible = this.content.visible;
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.getCanvas().dataset.sceneReady = "true";
  }
  pick(x: number, y: number): string | undefined {
    if (!this.enabled || !this.map || this.map.getZoom() < DETAIL_ZOOM) return;
    const canvas = this.map.getCanvas(),
      nx = (x / canvas.clientWidth) * 2 - 1,
      ny = 1 - (y / canvas.clientHeight) * 2;
    const near = new Vector3(nx, ny, -1).applyMatrix4(
      this.camera.projectionMatrixInverse,
    );
    const far = new Vector3(nx, ny, 1).applyMatrix4(
      this.camera.projectionMatrixInverse,
    );
    const hit = new Raycaster(near, far.sub(near).normalize()).intersectObjects(
      this.content.children,
      true,
    )[0];
    return hit?.faceIndex == null
      ? undefined
      : (hit.object as Mesh).geometry.userData.buildingIds[hit.faceIndex];
  }
  projectRoof(building: Building): { x: number; y: number } | undefined {
    if (!this.map) return;
    const geometry = buildGeometry([building]),
      positions = geometry.roofs.getAttribute("position"),
      point = new Vector3();
    for (let i = 0; i < 3; i++)
      point.add(new Vector3().fromBufferAttribute(positions, i));
    point.divideScalar(3).applyMatrix4(this.camera.projectionMatrix);
    Object.values(geometry).forEach((g) => g.dispose());
    const canvas = this.map.getCanvas();
    return {
      x: ((point.x + 1) * canvas.clientWidth) / 2,
      y: ((1 - point.y) * canvas.clientHeight) / 2,
    };
  }
  select(building?: Building): void {
    this.disposeGroup(this.highlight);
    this.selected = building;
    if (building) {
      for (const geometry of Object.values(buildGeometry([building], true)))
        this.highlight.add(new Mesh(geometry, this.material));
      this.highlight.position.z = 0.08;
    }
    this.map?.triggerRepaint();
  }
  setEnabled(value: boolean): void {
    this.enabled = value;
    this.update();
  }
  private disposeGroup(group: Group): void {
    group.traverse((obj) => {
      if (obj instanceof Mesh) obj.geometry.dispose();
    });
    group.clear();
  }
  onRemove(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    this.workers.forEach((worker) => worker.terminate());
    this.pending.clear();
    this.map?.off("move", this.onMove);
    this.map?.off("moveend", this.update);
    this.disposeGroup(this.content);
    this.disposeGroup(this.highlight);
    this.resident.clear();
    this.material.dispose();
    this.renderer?.dispose();
  }
}
