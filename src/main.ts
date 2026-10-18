import "./style.css";
import { centre } from "../shared/geo";
import type { Building } from "../shared/types";
import type { ComparableFilters } from "./property/comparables";
import { MapController, type Layers } from "./map/controller";
import {
  buildingTitle,
  createDemo,
  comparableSales,
  findBuilding,
  parseGeography,
} from "./property/data";
import {
  renderAreaContext,
  renderSchoolsContext,
  renderComparison,
  renderDetails,
  provenanceHtml,
} from "./ui/details";
import { loadNeighbourhoods, neighbourhoodAt } from "./neighbourhood/areas";
import type { Neighbourhoods } from "../shared/neighbourhoods";
import { connectSearch } from "./ui/search";
import { escapeHtml, icon, notice, shell } from "./ui/shell";

import { SalePoints } from "./map/sale-points";
import { connectSoldPrices } from "./ui/sold-prices";
import { connectSchools } from "./ui/schools";
import { loadSchools, nearbySchools } from "./schools/schools";
import type { Schools } from "../shared/schools";

shell();
const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
async function json(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      `Local dataset could not load (${response.status}). Run npm ci and restart the server.`,
    );
  return response.json();
}

async function start(): Promise<void> {
  const raw = await json("/data/geography.v2.json");
  const geography = parseGeography(raw);
  const demo = createDemo(geography.buildings);
  const details = element("#details"),
    intro = element("#intro"),
    comparison = element("#comparison");
  let selected: Building | undefined,
    tab: "building" | "sales" = "building",
    sampleEnabled = false;
  const salesFilters: ComparableFilters = {
    radiusMetres: 500,
    maxAgeMonths: 60,
    asOf: "2026-10-02",
  };
  const saved = new Set<string>();
  const savedRecords = new Map<string, Building>();
  let selectionRequest = 0;
  const known = (id: string) =>
    selected?.id === id
      ? selected
      : (savedRecords.get(id) ?? findBuilding(geography.buildings, id));
  const layers: Layers = {
    buildings: true,
    neighbourhood: false,
    schools: false,
    labels: true,
  };
  const controller = new MapController(geography, (id) => select(id, false));
  controller.scene.onStatus = (status) => {
    const text = !status.enabled
      ? "Building footprints"
      : status.overview
        ? "Area overview · zoom in for roof detail"
        : status.failed
          ? "Some building detail unavailable"
          : status.loading
            ? "Loading nearby building detail…"
            : status.limited
              ? "Detailed buildings nearby · simpler distant buildings"
              : "Nearby building detail ready";
    element("#detail-status").textContent = text;
    element("#retry-detail").hidden = !status.failed;
  };
  element("#retry-detail").onclick = () => controller.scene.retry();
  element("#overview").onclick = () => {
    closePanels();
    controller.overview();
  };
  await controller.ready();
  element("#loading").hidden = true;
  element("#geography-status").textContent =
    `${geography.buildingCount.toLocaleString("en-GB")} real footprints · Greater Reading`;
  element("#map").dataset.ready = "true";
  controller.map.on("error", () =>
    notice("A local map asset failed to load. Reload to try again."),
  );

  const salePoints = new SalePoints(controller.map);
  const soldPrices = connectSoldPrices(() => {
    closePanels();
    intro.hidden = true;
  }, salePoints);

  const schoolsPanel = connectSchools(
    () => {
      closePanels(false);
      intro.hidden = true;
    },
    {
      onSelect: (school) => controller.highlightSchool(school, !!school),
      onData: (data) => {
        schools = data;
        controller.showSchools(data);
      },
    },
  );
  controller.onSchool = (urn) => {
    if (!schools) return;
    layers.schools = true;
    schoolsPanel.select(urn);
  };

  function closePanels(restoreIntro = true): void {
    schoolsPanel.close();
    soldPrices.close();
    selectionRequest++;
    details.removeAttribute("aria-busy");
    details.hidden = true;
    comparison.hidden = true;
    intro.hidden = !restoreIntro;
    selected = undefined;
    controller.select(undefined);
    controller.showComparables([], select);
  }
  function showDetail(): void {
    if (!selected) return;
    schoolsPanel.close();
    soldPrices.close();
    details.innerHTML = renderDetails(
      selected,
      geography,
      demo,
      sampleEnabled,
      tab,
      saved.has(selected.id),
      salesFilters,
    );
    details.hidden = false;
    comparison.hidden = true;
    intro.hidden = true;
    fillAreaContext(selected);
    fillSchoolsContext(selected);
    element("#details-close").onclick = () => {
      closePanels();
      element("#search").focus();
    };
    details
      .querySelectorAll<HTMLButtonElement>("[data-tab]")
      .forEach((button) => {
        button.onclick = () => {
          tab = button.dataset.tab as typeof tab;
          showDetail();
          details.scrollTop = 0;
          element<HTMLButtonElement>(`[data-tab="${tab}"]`).focus();
        };
      });
    details
      .querySelector<HTMLButtonElement>("#open-demo-sales")
      ?.addEventListener("click", () => openExample("sales"));
    details
      .querySelectorAll<HTMLButtonElement>("[data-comparable]")
      .forEach((button) => {
        button.onclick = () => select(button.dataset.comparable!);
      });
    for (const id of ["sales-radius", "sales-age", "sales-type"])
      details
        .querySelector<HTMLSelectElement>(`#${id}`)
        ?.addEventListener("change", (event) => {
          const value = (event.target as HTMLSelectElement).value;
          if (id === "sales-radius") salesFilters.radiusMetres = Number(value);
          if (id === "sales-age") salesFilters.maxAgeMonths = Number(value);
          if (id === "sales-type")
            salesFilters.type = (value ||
              undefined) as ComparableFilters["type"];
          showDetail();
          element(`#${id}`).focus({ preventScroll: true });
        });
    element("#save-building").onclick = () => {
      if (saved.has(selected!.id)) {
        saved.delete(selected!.id);
        savedRecords.delete(selected!.id);
      } else if (saved.size === 3) {
        notice(
          "Your comparison holds up to three buildings. Remove one to add another.",
        );
        return;
      } else {
        saved.add(selected!.id);
        savedRecords.set(selected!.id, selected!);
      }
      element("#compare-count").textContent = String(saved.size);
      showDetail();
      element("#save-building").focus();
    };
    const showSamples =
      sampleEnabled &&
      tab === "sales" &&
      demo.locations.some((p) => p.buildingId === selected!.id);
    controller.showComparables(
      showSamples
        ? comparableSales(
            demo.locations.find((p) => p.buildingId === selected!.id)!,
            demo.locations,
            demo.transactions,
            salesFilters.radiusMetres,
            salesFilters,
          ).map((t) =>
            findBuilding(
              geography.buildings,
              demo.locations.find((p) => p.id === t.propertyRef)!.buildingId!,
            )!,
          )
        : [],
      select,
    );
  }
  let neighbourhoods: Neighbourhoods | undefined;
  let schools: Schools | undefined;
  function fillAreaContext(building: Building): void {
    const body = details.querySelector<HTMLElement>("#area-context-body");
    if (!body) return;
    const fill = (data: Neighbourhoods) => {
      body.innerHTML = renderAreaContext({
        status: "ready",
        data,
        area: neighbourhoodAt(centre(building.rings), data),
      });
    };
    if (neighbourhoods) return fill(neighbourhoods);
    // Only fetch the area asset once someone asks for area context.
    const section = details.querySelector<HTMLDetailsElement>("#area-context")!;
    if (!section.open) {
      section.addEventListener("toggle", () => fillAreaContext(building), {
        once: true,
      });
      return;
    }
    loadNeighbourhoods().then(
      (data) => {
        neighbourhoods = data;
        // The panel may have moved on to another building while loading.
        if (selected === building && body.isConnected) fill(data);
      },
      () => {
        if (body.isConnected)
          body.innerHTML = renderAreaContext({ status: "error" });
      },
    );
  }
  function fillSchoolsContext(building: Building): void {
    const section =
      details.querySelector<HTMLDetailsElement>("#schools-context");
    const body = details.querySelector<HTMLElement>("#schools-context-body");
    if (!section || !body) return;
    const fill = (data: Schools) => {
      body.innerHTML = renderSchoolsContext({
        status: "ready",
        data,
        nearby: nearbySchools(centre(building.rings), data.schools, 1500, 5),
        radius: 1500,
      });
    };
    const load = () => {
      if (schools) return fill(schools);
      body.innerHTML = renderSchoolsContext({ status: "loading" });
      loadSchools().then(
        (data) => {
          schools = data;
          if (selected === building && body.isConnected) fill(data);
        },
        () => {
          if (body.isConnected)
            body.innerHTML = renderSchoolsContext({ status: "error" });
        },
      );
    };
    // The asset is fetched only when someone opens the section.
    if (section.open) load();
    else section.addEventListener("toggle", () => section.open && load());
  }
  async function showAreaLayer(): Promise<void> {
    try {
      neighbourhoods ??= await loadNeighbourhoods();
      controller.showAreas(neighbourhoods);
    } catch {
      notice(
        "Official area statistics could not load. Toggle the layer to retry.",
      );
    }
  }
  async function select(id: string, fly = true): Promise<void> {
    const request = ++selectionRequest;
    details.setAttribute("aria-busy", "true");
    try {
      const building = known(id) ?? (await controller.repository.get(id));
      if (request !== selectionRequest) return;
      if (!building) {
        notice(
          "That footprint has no detail record inside this snapshot’s boundary.",
        );
        return;
      }
      selected = building;
      controller.select(building, fly);
      showDetail();
      details.scrollTop = 0;
      element("#property-heading").focus({ preventScroll: true });
    } catch {
      if (request === selectionRequest)
        notice(
          "Building details could not load. Select the building again to retry.",
        );
    } finally {
      if (request === selectionRequest) details.removeAttribute("aria-busy");
    }
  }
  function openExample(view: "building" | "sales" = "building"): void {
    sampleEnabled = true;
    tab = view;
    select(demo.buildingId);
  }
  function showComparison(): void {
    schoolsPanel.close();
    soldPrices.close();
    comparison.innerHTML = renderComparison(
      [...saved].map((id) => savedRecords.get(id)!),
    );
    comparison.hidden = false;
    details.hidden = true;
    intro.hidden = true;
    controller.showComparables([], select);
    element("#comparison-close").onclick = () => {
      if (selected) showDetail();
      else closePanels();
      element("#compare-open").focus();
    };
    comparison
      .querySelectorAll<HTMLButtonElement>("[data-open-building]")
      .forEach((button) => {
        button.onclick = () => {
          tab = "building";
          select(button.dataset.openBuilding!);
        };
      });
    comparison
      .querySelectorAll<HTMLButtonElement>("[data-remove-building]")
      .forEach((button) => {
        button.onclick = () => {
          saved.delete(button.dataset.removeBuilding!);
          savedRecords.delete(button.dataset.removeBuilding!);
          element("#compare-count").textContent = String(saved.size);
          showComparison();
        };
      });
    element("#comparison-heading").focus({ preventScroll: true });
  }
  element("#compare-open").onclick = showComparison;
  element("#example").onclick = () => openExample();
  connectSearch(
    () => controller.repository.getSearch(),
    geography.places,
    (id) => {
      tab = "building";
      select(id);
    },
    (place) => {
      closePanels();
      controller.focus(place.position);
      notice(place.name);
    },
    () => openExample(),
  );

  function applyLayers(): void {
    controller.layers(layers);
    for (const [key, value] of Object.entries(layers))
      element<HTMLInputElement>(`#layer-${key}`).checked = value;
    element("#area-legend").hidden = !layers.neighbourhood;
    if (layers.neighbourhood) void showAreaLayer();
    if (layers.schools) void showSchoolLayer();
  }
  async function showSchoolLayer(): Promise<void> {
    try {
      schools ??= await loadSchools();
      controller.showSchools(schools);
    } catch {
      notice("School locations could not load. Toggle the layer to retry.");
    }
  }
  element("#layers-button").onclick = () => {
    const panel = element("#layers-panel");
    panel.hidden = !panel.hidden;
    element("#layers-button").setAttribute(
      "aria-expanded",
      String(!panel.hidden),
    );
  };
  for (const key of Object.keys(layers) as (keyof Layers)[])
    element<HTMLInputElement>(`#layer-${key}`).onchange = (event) => {
      layers[key] = (event.target as HTMLInputElement).checked;
      applyLayers();
    };
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      button.onclick = () => {
        document
          .querySelectorAll("[data-mode]")
          .forEach((el) =>
            el.setAttribute("aria-pressed", String(el === button)),
          );
        layers.buildings = true;
        layers.neighbourhood = button.dataset.mode === "neighbourhood";
        layers.schools = button.dataset.mode === "schools";
        applyLayers();
        if (layers.schools) void schoolsPanel.open();
        else schoolsPanel.close();
        if (button.dataset.mode === "property")
          notice(
            "Select a building or search a mapped address. Try the example for sample sales.",
          );
        if (layers.neighbourhood)
          notice(
            "Census 2021 population density by LSOA. Area-level figures, not individual homes.",
          );
      };
    });
  element("#zoom-in").onclick = () => controller.map.zoomIn();
  element("#zoom-out").onclick = () => controller.map.zoomOut();
  const duration = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
  element("#north").onclick = () =>
    controller.map.easeTo({ bearing: 0, duration: duration() });
  element("#home-view").onclick = () => {
    closePanels();
    controller.home();
  };
  element("#tilt").onclick = () =>
    controller.map.easeTo({
      pitch: controller.map.getPitch() > 10 ? 0 : 52,
      duration: duration(),
    });
  controller.map.on("pitchend", () =>
    element("#tilt").setAttribute(
      "aria-pressed",
      String(controller.map.getPitch() > 10),
    ),
  );

  for (const name of ["Reading Town Hall", "Reading Abbey", "The Hexagon"]) {
    const building = geography.buildings.find((b) => b.name === name);
    if (!building) continue;
    const button = document.createElement("button");
    button.textContent = name.replace("Reading ", "");
    button.onclick = () => {
      tab = "building";
      select(building.id);
    };
    element("#place-buttons").append(button);
  }
  const dialog = element<HTMLDialogElement>("#sources-dialog");
  element("#sources-content").innerHTML =
    `<div class="eyebrow">THE SMALL PRINT, IN PLAIN SIGHT</div><h2>Know what you’re looking at.</h2><p>readmove is an independent property and neighbourhood research prototype. There are no live listings. The Sold prices panel contains real HM Land Registry transactions from the 2025 annual file, separately from the fictional map examples.</p>
    <h3>Real geography</h3><p>${geography.buildingCount.toLocaleString("en-GB")} OpenStreetMap building footprints, roads, water and railways in a bounded greater Reading snapshot. Redistributed from Mini Reading’s ODbL dataset; this is a separate application.</p>${provenanceHtml(geography.provenance)}
    <h3>Illustrative architecture</h3><p>Height uses mapped measurements, mapped storeys, or a deterministic estimate. The panel tells you which. Residential roofs, windows and materials are procedural, not a reconstruction. Flat ground; no surveyed terrain or property boundaries.</p>
    <h3>Clearly marked fixtures</h3><p>Example sale prices, transaction dates and property links are fictional. No fixture is a statement about a real resident or property.</p>
    <h3>Neighbourhood statistics</h3><p>217 official December 2021 Lower layer Super Output Areas (ONS BGC V5, generalised to 20 m) that intersect the map, with Census 2021 usual residents (TS001) and published population density (TS006) for 21 March 2021. Figures describe whole areas, never an individual home or resident. Boundaries are generalised, so edges are approximate. Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2025. <a href="/data/neighbourhoods.v1.json">Sources, editions and checksums ↗</a></p>
    <h3>Official sold prices</h3><p>6,325 residential transactions in selected Reading-area postcode districts. Partial history; postcode coverage is not exact map coverage. No sale is yet linked to a map building. Source file updated 28 September 2026. Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0. <a href="https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads#using-or-publishing-our-price-paid-data" target="_blank" rel="noopener">Source and address-data terms ↗</a></p>
    <h3>Verified sale points</h3><p>July and August 2026 official HMLR lookups match 246 transactions. OS Open UPRN September 2026 (extracted 14 August 2026) locates all 246; 177 are inside the map bounds. Points do not establish OSM building identity or property boundaries. UPRNs contain OS data © Crown copyright and database rights 2026. Contains Ordnance Survey data © Crown copyright and database right 2026. Licensed under OGL v3.0. <a href="/data/sale-locations.v2.json">Sources, match evidence and checksums ↗</a></p>
    <h3>Schools</h3><p>Open establishments in the map area from the Department for Education’s Get Information about Schools register (extract 18 October 2026), shown at their published locations converted to latitude/longitude (about 5 m). Distances are straight-line, not routes, catchments or admission eligibility. No Ofsted ratings are included. Contains public sector information licensed under the Open Government Licence v3.0. <a href="/data/schools.v1.json">Sources and checksum ↗</a></p>
    <h3>Not connected yet</h3><p>Verified building associations, EPCs, further Census topics, Ofsted inspection information and Environment Agency flood mapping. Flood polygons will not become unsupported property risk scores.</p>
    <p class="fine-note">No tracking, resident profiles, portal scraping or external map requests. Geography: ODbL 1.0. App: MIT. <a href="/data/provenance.json" target="_blank" rel="noopener">Dataset manifest ↗</a></p>`;
  element("#about").onclick = () => dialog.showModal();
  element("#sources-close").onclick = () => dialog.close();
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      dialog.open ||
      !element("#search-results").hidden
    )
      return;
    element("#layers-panel").hidden = true;
    element("#layers-button").setAttribute("aria-expanded", "false");
    const wasSoldOpen = soldPrices.isOpen();
    if (!details.hidden || !comparison.hidden || wasSoldOpen) {
      closePanels();
      if (wasSoldOpen) element("#sold-open").focus();
    }
  });
  window.addEventListener(
    "pagehide",
    () => {
      salePoints.clear();
      controller.destroy();
    },
    {
      once: true,
    },
  );
  // A narrow read-only development hook lets browser tests validate map state and actual picking.
  if (import.meta.env.DEV)
    Object.assign(window, {
      __readmove: {
        projectRoof: (id: string) => {
          const b = known(id);
          return b ? controller.scene.projectRoof(b) : undefined;
        },
        project: (id: string) => {
          const b = known(id);
          return b ? controller.map.project(centre(b.rings)) : null;
        },
        snapshot: () => ({
          moving: controller.map.isMoving(),
          selected: selected?.id,
          example: demo.buildingId,
          layers: { ...layers },
          neighbourhoodVisible: controller.map.getLayoutProperty(
            "neighbourhood-fill",
            "visibility",
          ),
          schoolsLoaded: schools?.schools.length ?? 0,
          schoolsVisible: controller.map.getLayoutProperty(
            "schools-circle",
            "visibility",
          ),
          schoolsRendered: controller.map.queryRenderedFeatures({
            layers: ["schools-circle"],
          }).length,
          neighbourhoodAreas: neighbourhoods?.areas.length ?? 0,
          neighbourhoodRendered: controller.map.queryRenderedFeatures({
            layers: ["neighbourhood-fill"],
          }).length,
          footprints: geography.buildingCount,
          tilesLoaded: controller.map.areTilesLoaded(),
          visibleRoadFeatures: controller.map.queryRenderedFeatures({
            layers: ["roads"],
          }).length,
          scene: controller.scene.status(),
          camera: {
            centre: controller.map.getCenter().toArray(),
            zoom: controller.map.getZoom(),
            pitch: controller.map.getPitch(),
            minZoom: controller.map.getMinZoom(),
            maxZoom: controller.map.getMaxZoom(),
            bounds: controller.map.getMaxBounds()?.toArray(),
          },
          sampleName: buildingTitle(
            findBuilding(geography.buildings, demo.buildingId)!,
          ),
        }),
      },
    });
}

start().catch((error) => {
  console.error(error);
  element("#loading").innerHTML =
    `<strong>The map couldn’t start</strong><span>${escapeHtml(error instanceof Error ? error.message : "Unknown startup error")}</span><button id="reload" class="primary">Try again ${icon("arrow")}</button><small>readmove needs a browser with WebGL2 enabled.</small>`;
  element("#reload").onclick = () => location.reload();
});
