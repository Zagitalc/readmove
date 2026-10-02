import { centre, distanceMetres } from "../../shared/geo";
import type { Building, Geography, Provenance } from "../../shared/types";
import { neighbourhoodAt } from "../neighbourhood/areas";
import {
  buildingTitle,
  comparableSales,
  type createDemo,
} from "../property/data";
import type { ComparableFilters } from "../property/comparables";
import { escapeHtml as e, icon } from "./shell";

const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export function provenanceHtml(provenance: Provenance): string {
  const name = e(provenance.source);
  const source =
    provenance.url && /^https:\/\//.test(provenance.url)
      ? `<a href="${e(provenance.url)}" target="_blank" rel="noopener">${name} ↗</a>`
      : name;
  return `<div class="provenance"><span class="source-label">${provenance.quality === "fixture" ? "FICTIONAL DEVELOPMENT DATA" : "SOURCE & SNAPSHOT"}</span>${source}<small>${e(provenance.date)} · ${e(provenance.license)}</small></div>`;
}
export const heightLabel = (b: Building): string =>
  b.heightSource === "measured"
    ? "Mapped height"
    : b.heightSource === "levels"
      ? "Height from mapped storeys"
      : "Estimated building height";

export function renderDetails(
  building: Building,
  geography: Geography,
  demo: ReturnType<typeof createDemo>,
  sampleEnabled: boolean,
  tab: "building" | "sales",
  saved: boolean,
  filters: ComparableFilters,
): string {
  const location = sampleEnabled
    ? demo.locations.find((p) => p.buildingId === building.id)
    : undefined;
  const area = neighbourhoodAt(centre(building.rings));
  const transactions = location
    ? demo.transactions
        .filter((t) => t.propertyRef === location.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const nearby = location
    ? comparableSales(
        location,
        demo.locations,
        demo.transactions,
        filters.radiusMetres,
        filters,
      )
    : [];
  return `
    <div class="sheet-handle" aria-hidden="true"></div>
    <button id="details-close" class="close-button" aria-label="Close building details">${icon("close")}</button>
    <div class="eyebrow">${location ? "EXAMPLE PROPERTY" : "A CLOSER LOOK"}</div>
    <h2 tabindex="-1" id="property-heading">${location ? "An example home" : e(buildingTitle(building))}</h2>
    <p class="property-location">${e(building.name && building.address ? building.name : "Greater Reading")} · Berkshire</p>
    ${location ? '<div class="fixture-banner"><strong>Demonstration only</strong>Fictional property and sales, placed on a real OSM building. No verified link to an address or dwelling.</div>' : '<span class="mapped-badge"><span class="dot"></span> OpenStreetMap footprint</span>'}
    <div class="detail-tabs" aria-label="Detail views"><button data-tab="building" aria-pressed="${tab === "building"}">Building</button><button data-tab="sales" aria-pressed="${tab === "sales"}">${location ? "Sample sales" : "Property data"}</button></div>
    ${
      tab === "building"
        ? `
      <div class="metric-row"><div><span>${e(heightLabel(building))}</span><strong>${building.height.toFixed(1)} <small>m</small></strong></div><div><span>Mapped building type</span><strong class="type-value">${e(building.kind === "yes" ? "Unspecified" : building.kind.replaceAll("_", " "))}</strong></div></div>
      <p class="fine-note">${building.heightSource === "measured" ? "Height is tagged in OSM, not independently surveyed by readmove." : building.heightSource === "levels" ? "Derived using mapped storeys × 3 metres. Not a measured height." : "Deterministic estimate from the building category. Not a measured height."} Roofs, windows and materials are illustrative.</p>
      <h3>The property behind the footprint</h3>
      <dl class="facts"><div><dt>Address</dt><dd>${e(building.address ?? "Not available")}</dd></div><div><dt>UPRN</dt><dd>Not linked</dd></div><div><dt>EPC / floor area</dt><dd>Not connected</dd></div><div><dt>Price per m²</dt><dd>Not available</dd></div></dl>
      <p class="fine-note">One building can contain several homes. A footprint is not a legal property boundary.</p>
      <details class="area-context"><summary>Neighbourhood example <span class="tiny-tag">DEMO</span></summary><p>${e(area?.name ?? "Outside fixture coverage")}. Illustrative areas only; official LSOAs and Census statistics are not connected.</p><p>Area-level statistics describe an area, never an individual home or resident.</p></details>
      ${provenanceHtml(geography.provenance)}
      <span class="record-id">Footprint reference: ${e(building.id)}</span>
    `
        : location
          ? `
      <h3>Sample transaction history</h3>
      <p class="fine-note">All amounts, dates, types and tenures below are fictional. They are not Land Registry observations.</p>
      <ol class="transaction-list">${transactions.map((t) => `<li><span><strong>${money(t.price)}</strong><small>${e(t.type)} · ${e(t.tenure)} · fixture</small></span><time datetime="${t.date}">${date(t.date)}</time></li>`).join("")}</ol>
      <h3>Nearby sample sales <small>within ${filters.radiusMetres.toLocaleString("en-GB")} m · as of ${e(filters.asOf)}</small></h3>
      <div class="comparable-filters" aria-label="Comparable sale filters">
      <label>Distance<select id="sales-radius"><option value="250" ${filters.radiusMetres === 250 ? "selected" : ""}>250 m</option><option value="500" ${filters.radiusMetres === 500 ? "selected" : ""}>500 m</option><option value="1000" ${filters.radiusMetres === 1000 ? "selected" : ""}>1 km</option></select></label>
      <label>Sold within<select id="sales-age"><option value="12" ${filters.maxAgeMonths === 12 ? "selected" : ""}>12 months</option><option value="24" ${filters.maxAgeMonths === 24 ? "selected" : ""}>24 months</option><option value="60" ${filters.maxAgeMonths === 60 ? "selected" : ""}>5 years</option></select></label>
      <label>Property type<select id="sales-type"><option value="" ${!filters.type ? "selected" : ""}>Any type</option><option value="terraced" ${filters.type === "terraced" ? "selected" : ""}>Terraced</option><option value="flat" ${filters.type === "flat" ? "selected" : ""}>Flat</option><option value="detached" ${filters.type === "detached" ? "selected" : ""}>Detached</option><option value="semi-detached" ${filters.type === "semi-detached" ? "selected" : ""}>Semi-detached</option></select></label>
      </div>
      ${nearby.length ? "" : '<p class="fine-note" role="status">No sample sales match these filters. Missing results are not evidence of no real sales.</p>'}
      <div class="comparable-list">${nearby
        .map((t, index) => {
          const p = demo.locations.find((p) => p.id === t.propertyRef)!;
          return `<button data-comparable="${e(p.buildingId)}"><span class="number-dot">${index + 1}</span><span><strong>${money(t.price)}</strong><small>${Math.round(distanceMetres(location.position, p.position))} m straight-line · ${date(t.date)}</small></span>${icon("arrow")}</button>`;
        })
        .join("")}</div>
      <p class="fine-note">A comparison workflow demonstration, not a valuation. Filters use property type, straight-line distance and transaction age. Historical prices are not adjusted to today’s market.</p>
      ${provenanceHtml(transactions[0].provenance)}
    `
          : `
      <div class="empty-state">${icon("home")}<h3>No verified property records yet</h3><p>Historic sales, EPCs and UPRNs have not been joined to this footprint. Missing data does not mean there have been no sales.</p><button id="open-demo-sales" class="secondary">Try the sample sales workflow ${icon("arrow")}</button></div>
    `
    }
    <button id="save-building" class="secondary full">${saved ? "Remove from comparison" : "Add building to comparison"} ${icon("arrow")}</button>
  `;
}

export function renderComparison(buildings: Building[]): string {
  return `<div class="sheet-handle" aria-hidden="true"></div><button id="comparison-close" class="close-button" aria-label="Close comparison">${icon("close")}</button>
    <div class="eyebrow">YOUR SHORTLIST · THIS SESSION</div><h2 tabindex="-1" id="comparison-heading">A little perspective.</h2>
    <p class="property-location">Compare up to three mapped buildings.</p>
    ${buildings.length ? buildings.map((b, i) => `<article class="comparison-item"><span class="number-dot">${i + 1}</span><div><button class="text-link" data-open-building="${e(b.id)}">${e(buildingTitle(b))}</button><p>${e(heightLabel(b))}: ${b.height.toFixed(1)} m<br>Mapped type: ${e(b.kind === "yes" ? "unspecified" : b.kind.replaceAll("_", " "))}</p><button class="remove" data-remove-building="${e(b.id)}">Remove</button></div></article>`).join("") : '<div class="empty-state"><h3>Start with a building</h3><p>Select a footprint on the map or use search, then add it to your comparison.</p></div>'}
    <p class="fine-note">Heights can be estimated; roofs are illustrative. No valuation or housing quality score is implied. Your shortlist stays in memory and clears on reload.</p>`;
}
