import {
  verifiedLocationsSchema,
  type VerifiedLocations,
} from "../../shared/verified-locations";
import {
  publishedSalesSchema,
  type PublishedSales,
} from "../../shared/published-sales";
import { filterSoldPrices } from "../property/sold-prices";
import {
  locateSales,
  nearbySales,
  selectSaleFilters,
  type LocatedSale,
  type SoldFilters,
} from "../property/located-sales";
import { escapeHtml as esc, icon } from "./shell";
import { saleRecord, soldProvenance } from "./sold-price-content";
export interface SoldMap {
  show: (
    points: LocatedSale[],
    selected: string | undefined,
    onSelect: (id: string) => void,
  ) => void;
  fit: (points: LocatedSale[]) => void;
  clear: () => void;
}
export function connectSoldPrices(beforeOpen: () => void, map: SoldMap) {
  const panel = document.querySelector<HTMLElement>("#official-sales")!;
  const open = document.querySelector<HTMLButtonElement>("#sold-open")!;
  let data: PublishedSales | undefined, pending: Promise<void> | undefined;
  let locations: VerifiedLocations | undefined, salesHash: string | undefined;
  let selected: LocatedSale | undefined;
  let filters: SoldFilters = {
    query: "",
    type: "",
    category: "A",
    identifierOnly: false,
    radius: 1000,
    since: "",
  };
  const close = () => {
    panel.hidden = true;
    open.setAttribute("aria-expanded", "false");
    map.clear();
  };
  function frame(html: string) {
    panel.innerHTML = `<div class="sold-toolbar"><span>Sold prices</span><button id="sold-close" aria-label="Close sold prices">${icon("close")}</button></div><div class="sold-body">${html}</div>`;
    panel.querySelector<HTMLButtonElement>("#sold-close")!.onclick = () => {
      close();
      open.focus();
    };
  }
  function loading(message: string) {
    frame(`<h2>Official sold prices</h2><p role="status">${esc(message)}</p>`);
  }
  async function loadIdentifiers() {
    const response = await fetch("/data/sale-locations.v2.json");
    if (!response.ok) throw new Error("Lookup unavailable");
    const parsed = verifiedLocationsSchema.parse(await response.json());
    const ids = new Set(data!.records.map((s) => s.id));
    if (
      parsed.salesAssetSha256 !== salesHash ||
      parsed.counts.residentialSales !== ids.size ||
      [...parsed.identifiers, ...parsed.ambiguous].some(
        (i) => !ids.has(i.transactionId),
      )
    )
      throw new Error("Lookup does not match this sale snapshot");
    locations = parsed;
  }
  function render(focus = true) {
    const located = locateSales(data!, locations);
    const identifiers = new Set(
      locations?.identifiers.map((i) => i.transactionId) ?? [],
    );
    frame(`<div class="eyebrow">HM LAND REGISTRY · REAL TRANSACTIONS</div><h2 id="sold-heading" tabindex="-1">${selected ? esc([selected.sale.address.saon, selected.sale.address.paon].filter(Boolean).join(", ")) : "Official sold prices"}</h2>
      ${selected ? `<button id="sold-back" class="text-link">Back to sold prices</button>${saleRecord(selected.sale, locations, selected, undefined, false)}<p class="fine-note">Selected official UPRN point. Building link unverified.</p><button id="sold-fit" class="primary">Fit nearby sales</button><p class="fine-note">Fits this property and all currently filtered comparable sales. Filters alone do not move the map.</p>` : `<p class="fine-note">${esc(data!.source.scope)}. ${data!.counts.residential.toLocaleString("en-GB")} residential transactions in selected Reading-area postcode districts.</p><p class="sold-scope">Addresses are not yet matched to map buildings. Only official in-bounds OS points are mapped. These records are not valuations or live listings.</p>`}
      <p id="sold-location-status" class="fine-note">${locations ? `${locations.counts.identifierMatches} transactions have an official UPRN · ${locations.counts.coordinateMatches} have verified coordinates · ${located.size} inside the map. July + August 2026 lookups; limited historical coverage.` : "UPRN lookup unavailable. Sale search still works; reopen Sold prices to retry."}</p>
      <label class="sold-search-label">Search sold addresses<input id="sold-query" type="search" placeholder="Street, town or postcode" autocomplete="off" ${selected ? 'disabled aria-describedby="sold-search-note"' : ""} /></label>${selected ? '<p id="sold-search-note" class="fine-note">Address search cleared for nearby comparisons. Use Back to search again.</p>' : ""}
      <div class="comparable-filters"><label>Property type<select id="sold-type"><option value="">All residential types</option><option value="detached">Detached</option><option value="semi-detached">Semi-detached</option><option value="terraced">Terraced</option><option value="flat">Flat / maisonette</option></select></label>
      <label>Transaction category<select id="sold-category"><option value="A">Standard (A)</option><option value="B">Additional (B)</option><option value="">Both categories</option></select></label>
      ${selected ? `<label>Nearby radius<select id="sold-radius"><option value="250">250 m</option><option value="500">500 m</option><option value="1000">1 km</option><option value="2000">2 km</option><option value="5000">5 km</option></select></label><label>Sold on or after<input id="sold-since" type="date" max="${new Date().toISOString().slice(0, 10)}" /></label>` : ""}</div>
      ${selected ? '<p class="fine-note">Nearby sales use straight-line distance and a sparse, partial 2025 history. Same-UPRN transactions are excluded. These are comparison candidates, not a valuation.</p>' : '<p class="fine-note">Category B includes repossessions, identifiable buy-to-lets and transfers to non-private individuals, without identifying which applies. Both categories may be revised or registered late.</p>'}
      <label class="sold-identifier-filter"><input id="sold-identifier-only" type="checkbox" ${!locations || selected ? "disabled" : ""} /> Only with an official UPRN</label>
      ${selected ? "<h3>Nearby comparable sales</h3>" : ""}<p id="sold-count" role="status" aria-live="polite"></p><div id="sold-results"></div><button id="sold-more" class="primary">Show more sales</button>${soldProvenance(data!, locations)}`);
    const el = <T extends HTMLElement>(id: string) =>
      panel.querySelector<T>(`#${id}`)!;
    const query = el<HTMLInputElement>("sold-query"),
      type = el<HTMLSelectElement>("sold-type"),
      category = el<HTMLSelectElement>("sold-category"),
      only = el<HTMLInputElement>("sold-identifier-only"),
      more = el<HTMLButtonElement>("sold-more");
    query.value = filters.query;
    type.value = filters.type;
    category.value = filters.category;
    only.checked = filters.identifierOnly && !!locations;
    if (selected) {
      el<HTMLSelectElement>("sold-radius").value = String(filters.radius);
      el<HTMLInputElement>("sold-since").value = filters.since;
    }
    let limit = 20;
    let mapPoints: LocatedSale[] = [];
    const select = (id: string) => {
      const point = located.get(id);
      if (!point || panel.hidden) return;
      filters = selectSaleFilters(filters);
      query.value = "";
      selected = point;
      render();
      // Selection focuses just this property; fitting comparisons is always explicit.
      map.fit([point]);
    };
    const refresh = () => {
      const nearby = selected
        ? nearbySales(
            data!,
            located,
            selected,
            filters,
            new Date().toISOString().slice(0, 10),
          )
        : undefined;
      const rows = nearby
        ? nearby.map((p) => p.sale)
        : filterSoldPrices(
            data!,
            filters.query,
            filters.type,
            filters.category,
          ).filter((s) => !only.checked || identifiers.has(s.id));
      const distances = new Map(nearby?.map((p) => [p.sale.id, p.distance]));
      el("sold-count").textContent =
        `${rows.length.toLocaleString("en-GB")} ${selected ? "nearby sales" : "transactions"} · showing ${Math.min(limit, rows.length)}`;
      el("sold-results").innerHTML =
        rows
          .slice(0, limit)
          .map((s) =>
            saleRecord(s, locations, located.get(s.id), distances.get(s.id)),
          )
          .join("") ||
        `<p>${selected ? "No nearby sales match these filters. Widen the radius or change type, category or date. Fit still shows the selected property." : "No transactions match these filters in this snapshot."}</p>`;
      more.hidden = limit >= rows.length;
      panel
        .querySelectorAll<HTMLButtonElement>("[data-sale]")
        .forEach((button) => {
          button.onclick = () => select(button.dataset.sale!);
        });
      mapPoints = selected
        ? [selected, ...nearby!]
        : rows.flatMap((s) => (located.get(s.id) ? [located.get(s.id)!] : []));
      if (!panel.hidden) map.show(mapPoints, selected?.sale.id, select);
    };
    const change = () => {
      Object.assign(filters, {
        query: query.value,
        type: type.value,
        category: category.value,
        identifierOnly: only.checked,
      });
      if (selected) {
        filters.radius = Number(el<HTMLSelectElement>("sold-radius").value);
        filters.since = el<HTMLInputElement>("sold-since").value;
      }
      limit = 20;
      refresh();
    };
    query.oninput = type.onchange = category.onchange = only.onchange = change;
    more.onclick = () => {
      limit += 20;
      refresh();
    };
    if (selected) {
      el<HTMLSelectElement>("sold-radius").onchange = change;
      el<HTMLInputElement>("sold-since").onchange = change;
      el("sold-fit").onclick = () => map.fit(mapPoints);
      el("sold-back").onclick = () => {
        selected = undefined;
        render(false);
        panel.querySelector<HTMLInputElement>("#sold-query")!.focus();
      };
    }
    refresh();
    if (focus && !panel.hidden)
      el("sold-heading").focus({ preventScroll: true });
  }
  open.onclick = async () => {
    beforeOpen();
    selected = undefined;
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
