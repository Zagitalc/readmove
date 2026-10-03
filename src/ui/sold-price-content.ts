import type {
  PublishedSale,
  PublishedSales,
} from "../../shared/published-sales";
import type { VerifiedLocations } from "../../shared/verified-locations";
import type { LocatedSale } from "../property/located-sales";
import { saleAddress } from "../property/sold-prices";
import { escapeHtml as esc } from "./shell";
const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
export function saleRecord(
  s: PublishedSale,
  locations: VerifiedLocations | undefined,
  located?: LocatedSale,
  distance?: number,
  selectable = true,
) {
  const identifier = locations?.identifiers.find(
    (i) => i.transactionId === s.id,
  );
  const coordinate =
    identifier &&
    locations?.coordinates.find((c) => c.uprn === identifier.uprn);
  return `<article class="sold-record"><strong>${esc(money.format(s.price))}</strong><time datetime="${esc(s.date)}">${esc(s.date)}</time><p>${esc(saleAddress(s))}</p><small>${esc(s.type)} · ${esc(s.tenure)} · ${s.newBuild ? "New build" : "Not new build"} · Category ${esc(s.category)}${distance === undefined ? "" : ` · ${Math.round(distance)} m straight line`}</small>
    ${located && selectable ? `<button class="text-link sale-select" data-sale="${esc(s.id)}">Show mapped sale</button>` : ""}
    <details><summary>Transaction reference</summary><code>${esc(s.id)}</code><p>${identifier ? `Official UPRN: <span class="sale-uprn">${esc(identifier.uprn)}</span> · ${coordinate ? (located ? "official OS coordinate; building link unverified" : "official coordinate outside map bounds") : "coordinates pending"}` : "No UPRN match in these lookups"}</p>${
      identifier
        ? `<p>Exact-ID evidence: ${identifier.sourceHashes
            .map((h) => {
              const source = locations!.sources.find((s) => s.sha256 === h)!;
              return `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.period)} HMLR lookup</a>`;
            })
            .join(" · ")}</p>`
        : ""
    }</details></article>`;
}
export function soldProvenance(
  data: PublishedSales,
  locations?: VerifiedLocations,
) {
  const source = data.source;
  return `<div class="sold-provenance"><strong>Source snapshot ${esc(source.sourceDate)}</strong><p>${esc(source.sourceDateBasis)}; retrieved ${esc(source.retrievedAt.slice(0, 10))}. Type Other is excluded.</p><p>${esc(source.attribution)}</p><a href="${esc(source.termsUrl)}" target="_blank" rel="noopener">Source and address-data terms ↗</a> · <a href="/data/sales-2025.audit.json" target="_blank" rel="noopener">Import audit ↗</a>
    ${locations ? `<details><summary>UPRN and coordinate sources</summary>${locations.sources.map((s) => `<p><a href="${esc(s.url)}">${esc(s.period)} monthly HMLR lookup</a>, retrieved ${esc(s.retrievedOn)}.</p>`).join("")}${locations.sources[0].attribution.map((a) => `<p>${esc(a)}</p>`).join("")}<p>OS Open UPRN release ${esc(locations.coordinateSource.releasePeriod)}; extracted ${esc(locations.coordinateSource.snapshotDate)}; retrieved ${esc(locations.coordinateSource.retrievedOn)}.</p><p>${esc(locations.coordinateSource.attribution)}</p><p>Coordinates identify addressable locations, not property boundaries or OSM buildings. Monthly lookups are not a complete historical archive.</p><a href="/data/sale-locations.v2.json">Match evidence and checksums ↗</a></details>` : ""}</div>`;
}
