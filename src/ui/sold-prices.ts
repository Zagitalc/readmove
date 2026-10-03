import {
  saleLocationsSchema,
  type SaleLocations,
} from "../../shared/sale-locations";
import {
  publishedSalesSchema,
  type PublishedSales,
  type PublishedSale,
} from "../../shared/published-sales";
import { filterSoldPrices, saleAddress } from "../property/sold-prices";
import {
  locateSales,
  type LocatedResidentialSale,
} from "../property/located-sales";
import { findComparableSales } from "../property/comparables";
import type { Position } from "../../shared/types";
import { escapeHtml as esc, icon } from "./shell";

interface MapActions {
  show(
    sales: LocatedResidentialSale[],
    selected: string | undefined,
    select: (id: string) => void,
  ): void;
  clear(): void;
  focus(position: Position): void;
}
const money = (price: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(price);
export function connectSoldPrices(
  beforeOpen: () => void,
  map: MapActions,
): { close: () => void; isOpen: () => boolean } {
  const panel = document.querySelector<HTMLElement>("#official-sales")!;
  const open = document.querySelector<HTMLButtonElement>("#sold-open")!;
  let data: PublishedSales | undefined, pending: Promise<void> | undefined;
  let locations: SaleLocations | undefined, salesHash: string | undefined;
  let located = new Map<string, LocatedResidentialSale>(),
    selected: string | undefined;
  const filters = {
    query: "",
    type: "",
    category: "A",
    identifierOnly: false,
    mappableOnly: false,
    map: false,
    radius: 1000,
    age: 24,
  };
  const asOf = new Date().toISOString().slice(0, 10);
  let refresh = () => {};
  async function loadIdentifiers(): Promise<void> {
    const response = await fetch("/data/sale-locations.v2.json");
    if (!response.ok) throw new Error("Lookup unavailable");
    const parsed = saleLocationsSchema.parse(await response.json());
    const ids = new Set(data!.records.map((s) => s.id));
    if (
      parsed.salesAssetSha256 !== salesHash ||
      parsed.counts.residentialSales !== ids.size ||
      parsed.identifiers.some((i) => !ids.has(i.transactionId))
    )
      throw new Error("Lookup does not match this sale snapshot");
    locations = parsed;
    located = new Map(locateSales(data!, locations).map((s) => [s.id, s]));
  }
  const close = () => {
    panel.hidden = true;
    open.setAttribute("aria-expanded", "false");
    map.clear();
  };
  function choose(id: string): void {
    const sale = located.get(id);
    if (!sale) return;
    selected = id;
    filters.map = true;
    panel.querySelector<HTMLInputElement>("#sold-map-points")!.checked = true;
    refresh();
    map.focus(sale.position);
    panel
      .querySelector<HTMLElement>("#sold-selected")!
      .scrollIntoView({ block: "nearest" });
  }
  function loading(message: string): void {
    panel.innerHTML = `<button class="close-button" id="sold-close" aria-label="Close sold prices">${icon("close")}</button><h2>Official sold prices</h2><p role="status">${esc(message)}</p>`;
    panel.querySelector<HTMLButtonElement>("#sold-close")!.onclick = () => {
      close();
      open.focus();
    };
  }
  function render(): void {
    const source = data!.source;
    const identifiers = new Map(
      locations?.identifiers.map((i) => [i.transactionId, i.uprn]) ?? [],
    );
    const coordinateUprns = new Set(
      locations?.coordinates.map((p) => p.uprn) ?? [],
    );
    panel.innerHTML = `<button class="close-button" id="sold-close" aria-label="Close sold prices">${icon("close")}</button>
      <div class="eyebrow">HM LAND REGISTRY · REAL TRANSACTIONS</div><h2 id="sold-heading" tabindex="-1">Official sold prices</h2>
      <label class="sold-identifier-filter"><input id="sold-map-points" type="checkbox" ${!located.size ? "disabled" : ""}/> Show verified sale points</label>
      <p class="fine-note">${esc(source.scope)}. ${data!.counts.residential.toLocaleString("en-GB")} residential transactions.</p>
      <p class="sold-scope">Addresses are not yet matched to map buildings. Points show OS UPRN locations, not property boundaries.</p>
      <p id="sold-location-status" class="fine-note">${locations ? `${locations.counts.identifierMatches} transactions have an official UPRN · ${locations.counts.coordinateMatches} have verified coordinates · ${located.size} inside this map. ${locations.counts.outsideMapBounds} lie outside. Limited historical coverage.` : "UPRN lookup unavailable. Sale search still works; reopen Sold prices to retry."}</p>
      <section id="sold-selected" aria-label="Selected official sale" hidden></section>
      <label class="sold-search-label">Search sold addresses<input id="sold-query" type="search" placeholder="Street, town or postcode" autocomplete="off"/></label>
      <div class="comparable-filters"><label>Property type<select id="sold-type"><option value="">All residential types</option><option value="detached">Detached</option><option value="semi-detached">Semi-detached</option><option value="terraced">Terraced</option><option value="flat">Flat / maisonette</option></select></label>
      <label>Transaction category<select id="sold-category"><option value="A">Standard (A)</option><option value="B">Additional (B)</option><option value="">Both categories</option></select></label></div>
      <label class="sold-identifier-filter"><input id="sold-identifier-only" type="checkbox" ${!locations ? "disabled" : ""}/> Only with an official UPRN</label>
      <label class="sold-identifier-filter"><input id="sold-mappable-only" type="checkbox" ${!located.size ? "disabled" : ""}/> Only with a location inside this map</label>
      <p id="sold-count" role="status" aria-live="polite"></p><div id="sold-results"></div><button id="sold-more" class="primary">Show more sales</button>
      <details class="sold-provenance"><summary>Coverage, categories and sources</summary><p>Category B includes repossessions, identifiable buy-to-lets and transfers to non-private individuals; it does not identify which applies. Both categories may be revised or registered late. Type Other is excluded.</p><p>Source snapshot ${esc(source.sourceDate)} (${esc(source.sourceDateBasis)}); retrieved ${esc(source.retrievedAt.slice(0, 10))}. Postcode coverage extends beyond the map. These are not valuations or live listings.</p><p>${esc(source.attribution)}</p>
      <a href="${esc(source.termsUrl)}" target="_blank" rel="noopener">Source and address-data terms ↗</a> · <a href="/data/sales-2025.audit.json" target="_blank" rel="noopener">Import audit ↗</a>
      ${locations ? `<p>August 2026 transaction-to-UPRN lookup; retrieved ${esc(locations.source.retrievedOn)}.</p>${locations.source.attribution.map((a) => `<p>${esc(a)}</p>`).join("")}<a href="https://www.gov.uk/government/statistical-data-sets/transaction-unique-identifier-and-uprn-look-up-table-dataset" target="_blank" rel="noopener">Official lookup source ↗</a>` : ""}
      ${locations?.coordinateSource ? `<p>OS release ${esc(locations.coordinateSource.release)}; coordinates extracted ${esc(locations.coordinateSource.snapshotDate)}, retrieved ${esc(locations.coordinateSource.retrievedOn)}. Current snapshot locations do not establish geometry at the sale date.</p><p>${esc(locations.coordinateSource.attribution)}</p><a href="https://www.ordnancesurvey.co.uk/products/os-open-uprn" target="_blank" rel="noopener">OS Open UPRN ↗</a> · <a href="/data/sale-coordinates.audit.json" target="_blank" rel="noopener">Coordinate audit ↗</a>` : ""}</details>`;
    const q = panel.querySelector<HTMLInputElement>("#sold-query")!,
      type = panel.querySelector<HTMLSelectElement>("#sold-type")!,
      category = panel.querySelector<HTMLSelectElement>("#sold-category")!;
    const idOnly = panel.querySelector<HTMLInputElement>(
        "#sold-identifier-only",
      )!,
      mappable = panel.querySelector<HTMLInputElement>("#sold-mappable-only")!,
      showMap = panel.querySelector<HTMLInputElement>("#sold-map-points")!;
    q.value = filters.query;
    type.value = filters.type;
    category.value = filters.category;
    idOnly.checked = filters.identifierOnly && !!locations;
    mappable.checked = filters.mappableOnly && !!located.size;
    showMap.checked = filters.map && !!located.size;
    let limit = 20;
    const card = (
      s: PublishedSale,
      distance?: number,
    ) => `<article class="sold-record" data-transaction="${esc(s.id)}"><strong>${esc(money(s.price))}</strong><time datetime="${esc(s.date)}">${esc(s.date)}</time><p>${esc(saleAddress(s))}</p><small>${esc(s.type)} · ${esc(s.tenure)} · ${s.newBuild ? "New build" : "Not new build"} · Category ${esc(s.category)}${distance === undefined ? "" : ` · ${Math.round(distance)} m straight-line`}</small>
      ${located.has(s.id) ? `<button class="sold-locate" data-locate="${esc(s.id)}">View location &amp; nearby sales</button>` : coordinateUprns.has(identifiers.get(s.id) ?? "") ? '<p class="fine-note">Official coordinate outside this map</p>' : ""}
      <details><summary>Transaction reference</summary><code>${esc(s.id)}</code><p>${identifiers.has(s.id) ? `Official UPRN: <span class="sale-uprn">${esc(identifiers.get(s.id))}</span> · ${coordinateUprns.has(identifiers.get(s.id)!) ? "OS coordinate verified" : "coordinates pending"}` : "No UPRN match in this lookup"}</p></details></article>`;
    refresh = () => {
      const all = filterSoldPrices(
        data!,
        q.value,
        type.value,
        category.value,
      ).filter(
        (s) =>
          (!idOnly.checked || identifiers.has(s.id)) &&
          (!mappable.checked || located.has(s.id)),
      );
      const subject = selected ? located.get(selected) : undefined;
      const selection = panel.querySelector<HTMLElement>("#sold-selected")!;
      selection.hidden = !subject;
      let rows: PublishedSale[] = all;
      let distances = new Map<string, number>();
      if (subject) {
        const comparableRows = findComparableSales(
          subject,
          all.flatMap((s) => (located.has(s.id) ? [located.get(s.id)!] : [])),
          { radiusMetres: filters.radius, maxAgeMonths: filters.age, asOf },
        );
        rows = comparableRows;
        distances = new Map(
          comparableRows.map((s) => [s.id, s.distanceMetres]),
        );
        selection.innerHTML = `<h3>Selected official sale</h3><strong>${esc(money(subject.price))}</strong> · ${esc(subject.date)}<p>${esc(saleAddress(subject))}</p><small>${esc(subject.type)} · ${esc(subject.tenure)} · Category ${esc(subject.category)}</small>
        <div class="comparable-filters"><label>Nearby radius<select id="real-radius">${[250, 500, 1000, 2000].map((n) => `<option value="${n}" ${n === filters.radius ? "selected" : ""}>${n} m</option>`).join("")}</select></label><label>Transaction age<select id="real-age">${[12, 24, 60].map((n) => `<option value="${n}" ${n === filters.age ? "selected" : ""}>${n} months</option>`).join("")}</select></label></div>
        <p class="fine-note">Nearby mapped sales as of ${esc(asOf)}. Sparse lookup coverage; not a valuation or a complete set of comparable homes. Address, type and category filters below also apply.</p><button id="clear-official-selection">Back to all sales</button>`;
        panel.querySelector<HTMLSelectElement>("#real-radius")!.onchange = (
          e,
        ) => {
          filters.radius = Number((e.target as HTMLSelectElement).value);
          refresh();
        };
        panel.querySelector<HTMLSelectElement>("#real-age")!.onchange = (e) => {
          filters.age = Number((e.target as HTMLSelectElement).value);
          refresh();
        };
        panel.querySelector<HTMLButtonElement>(
          "#clear-official-selection",
        )!.onclick = () => {
          selected = undefined;
          refresh();
        };
      }
      panel.querySelector("#sold-count")!.textContent =
        `${rows.length.toLocaleString("en-GB")} ${subject ? "nearby mapped sales" : "transactions"} · showing ${Math.min(limit, rows.length)}`;
      panel.querySelector("#sold-results")!.innerHTML =
        rows
          .slice(0, limit)
          .map((s) => card(s, distances.get(s.id)))
          .join("") ||
        `<p>${subject ? "No mapped nearby sales match these filters. Unmatched transactions remain available in the full address search." : "No transactions match these filters in this snapshot."}</p>`;
      panel
        .querySelectorAll<HTMLButtonElement>("[data-locate]")
        .forEach((b) => (b.onclick = () => choose(b.dataset.locate!)));
      panel.querySelector<HTMLButtonElement>("#sold-more")!.hidden =
        limit >= rows.length;
      if (showMap.checked && !panel.hidden) {
        const pins = rows.flatMap((s) =>
          located.has(s.id) ? [located.get(s.id)!] : [],
        );
        if (subject) pins.unshift(subject);
        map.show(pins, selected, choose);
      } else map.clear();
    };
    q.oninput =
      type.onchange =
      category.onchange =
      idOnly.onchange =
      mappable.onchange =
      showMap.onchange =
        () => {
          Object.assign(filters, {
            query: q.value,
            type: type.value,
            category: category.value,
            identifierOnly: idOnly.checked,
            mappableOnly: mappable.checked,
            map: showMap.checked,
          });
          limit = 20;
          refresh();
        };
    panel.querySelector<HTMLButtonElement>("#sold-more")!.onclick = () => {
      limit += 20;
      refresh();
    };
    panel.querySelector<HTMLButtonElement>("#sold-close")!.onclick = () => {
      close();
      open.focus();
    };
    refresh();
    if (!panel.hidden)
      panel
        .querySelector<HTMLElement>("#sold-heading")!
        .focus({ preventScroll: true });
  }
  open.onclick = async () => {
    beforeOpen();
    panel.hidden = false;
    open.setAttribute("aria-expanded", "true");
    if (data && locations) {
      render();
      return;
    }
    if (pending) return;
    loading("Loading the local Land Registry snapshot…");
    pending = (async () => {
      try {
        if (!data) {
          const response = await fetch("/data/sales-2025.v1.json");
          if (!response.ok) throw new Error("Unavailable");
          const bytes = await response.arrayBuffer();
          salesHash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("");
          data = publishedSalesSchema.parse(
            JSON.parse(new TextDecoder().decode(bytes)),
          );
        }
        try {
          await loadIdentifiers();
        } catch {
          locations = undefined;
          located.clear();
        }
        render();
      } catch {
        loading(
          "Sold-price data could not load. Close this panel and open Sold prices to retry. The map remains available.",
        );
      } finally {
        pending = undefined;
      }
    })();
    await pending;
  };
  return { close, isOpen: () => !panel.hidden };
}
