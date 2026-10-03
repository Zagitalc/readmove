import {
  publishedSalesSchema,
  type PublishedSales,
} from "../../shared/published-sales";
import { filterSoldPrices, saleAddress } from "../property/sold-prices";
import { escapeHtml as esc, icon } from "./shell";

export function connectSoldPrices(beforeOpen: () => void): {
  close: () => void;
  isOpen: () => boolean;
} {
  const panel = document.querySelector<HTMLElement>("#official-sales")!;
  const open = document.querySelector<HTMLButtonElement>("#sold-open")!;
  let data: PublishedSales | undefined, pending: Promise<void> | undefined;
  const close = () => {
    panel.hidden = true;
    open.setAttribute("aria-expanded", "false");
  };
  function loading(message: string): void {
    panel.innerHTML = `<button class="close-button" id="sold-close" aria-label="Close sold prices">${icon("close")}</button><h2>Official sold prices</h2><p role="status">${esc(message)}</p>`;
    panel.querySelector<HTMLButtonElement>("#sold-close")!.onclick = () => {
      close();
      open.focus();
    };
  }
  function render(): void {
    const source = data!.source;
    panel.innerHTML = `<button class="close-button" id="sold-close" aria-label="Close sold prices">${icon("close")}</button>
      <div class="eyebrow">HM LAND REGISTRY · REAL TRANSACTIONS</div><h2 id="sold-heading" tabindex="-1">Official sold prices</h2>
      <p class="fine-note">${esc(source.scope)}. ${data!.counts.residential.toLocaleString("en-GB")} residential transactions in selected Reading-area postcode districts.</p>
      <p class="sold-scope">Addresses are not yet matched to map buildings. Postcode coverage extends beyond the map. These records are not valuations or live listings.</p>
      <label class="sold-search-label">Search sold addresses<input id="sold-query" type="search" placeholder="Street, town or postcode" autocomplete="off" /></label>
      <div class="comparable-filters"><label>Property type<select id="sold-type"><option value="">All residential types</option value="detached">Detached</option><option value="semi-detached">Semi-detached</option><option value="terraced">Terraced</option><option value="flat">Flat / maisonette</option></select></label>
      <label>Transaction category<select id="sold-category"><option value="A">Standard (A)</option><option value="B">Additional (B)</option><option value="">Both categories</option></select></label></div>
      <p class="fine-note">Additional transactions include repossessions, identifiable buy-to-lets and transfers to non-private individuals. Category B does not identify which of these applies. Both categories can be revised or registered late.</p>
      <p id="sold-count" role="status" aria-live="polite"></p><div id="sold-results"></div><button id="sold-more" class="primary">Show more sales</button>
      <div class="sold-provenance"><strong>Source snapshot ${esc(source.sourceDate)}</strong><p>${esc(source.sourceDateBasis)}; retrieved ${esc(source.retrievedAt.slice(0, 10))}. Newest transaction first. Type Other is excluded.</p><p>${esc(source.attribution)}</p>
      <a href="${esc(source.termsUrl)}" target="_blank" rel="noopener">Source and address-data terms ↗</a> · <a href="/data/sales-2025.audit.json" target="_blank" rel="noopener">Import audit ↗</a></div>`;
    const query = panel.querySelector<HTMLInputElement>("#sold-query")!;
    const type = panel.querySelector<HTMLSelectElement>("#sold-type")!;
    const category = panel.querySelector<HTMLSelectElement>("#sold-category")!;
    const more = panel.querySelector<HTMLButtonElement>("#sold-more")!;
    let limit = 20;
    const refresh = () => {
      const rows = filterSoldPrices(
        data!,
        query.value,
        type.value,
        category.value,
      );
      panel.querySelector("#sold-count")!.textContent =
        `${rows.length.toLocaleString("en-GB")} transactions · showing ${Math.min(limit, rows.length)}`;
      panel.querySelector("#sold-results")!.innerHTML =
        rows
          .slice(0, limit)
          .map(
            (s) =>
              `<article class="sold-record"><strong>${esc(new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(s.price))}</strong><time datetime="${esc(s.date)}">${esc(s.date)}</time><p>${esc(saleAddress(s))}</p><small>${esc(s.type)} · ${esc(s.tenure)} · ${s.newBuild ? "New build" : "Not new build"} · Category ${esc(s.category)}</small><details><summary>Transaction reference</summary><code>${esc(s.id)}</code></details></article>`,
          )
          .join("") ||
        "<p>No transactions match these filters in this snapshot.</p>";
      more.hidden = limit >= rows.length;
    };
    query.oninput =
      type.onchange =
      category.onchange =
        () => {
          limit = 20;
          refresh();
        };
    more.onclick = () => {
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
    if (data) {
      render();
      return;
    }
    if (pending) return;
    loading("Loading the local Land Registry snapshot…");
    pending = (async () => {
      try {
        const response = await fetch("/data/sales-2025.v1.json");
        if (!response.ok) throw new Error("Unavailable");
        data = publishedSalesSchema.parse(await response.json());
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
