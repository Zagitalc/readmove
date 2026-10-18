import { GIAS_RECORD, type School, type Schools } from "../../shared/schools";
import {
  ageLabel,
  defaultSchoolFilters,
  filterSchools,
  loadSchools,
  phases,
} from "../schools/schools";
import { escapeHtml as e, icon } from "./shell";

export const schoolProvenance = (data: Schools) =>
  `<div class="provenance"><span class="source-label">SOURCE &amp; SNAPSHOT</span><a href="${e(data.source.downloadsPage)}" target="_blank" rel="noopener">${e(data.source.name)} ↗</a><small>Extract ${e(data.source.extractDate)} · ${e(data.source.licence)}. ${e(data.source.attribution)}. Positions converted from British National Grid, about ${data.coordinates.approximateAccuracyMetres} m.</small></div>`;

export function schoolRow(school: School, metres?: number): string {
  const site = school.website
    ? ` · <a href="${e(school.website)}" target="_blank" rel="noopener">School website ↗</a>`
    : "";
  return `<strong>${e(school.name)}</strong>
    <small>${e(school.type)} · ${e(school.phase)} · ${e(ageLabel(school))}${metres === undefined ? "" : ` · ${Math.round(metres).toLocaleString("en-GB")} m straight-line`}</small>
    <small>${e(school.authority)}${school.postcode ? ` · ${e(school.postcode)}` : ""}${school.status === "Open" ? "" : ` · ${e(school.status)}`}</small>
    <small><a href="${e(GIAS_RECORD + school.urn)}" target="_blank" rel="noopener">Official record ↗</a>${site} · URN ${e(school.urn)}</small>`;
}

const PAGE = 25;
/** Schools panel: official DfE locations only; no ratings or admission claims. */
export function connectSchools(
  beforeOpen: () => void,
  hooks: {
    onSelect: (school: School | undefined) => void;
    onData: (data: Schools) => void;
  },
) {
  const panel = document.querySelector<HTMLElement>("#schools-panel")!;
  let data: Schools | undefined;
  let filters = defaultSchoolFilters();
  let shown = PAGE,
    selected: string | undefined;
  const frame = (html: string) => {
    panel.innerHTML = `<div class="sold-toolbar"><span>Schools</span><button id="schools-close" aria-label="Close schools">${icon("close")}</button></div><div class="sold-body">${html}</div>`;
    panel.querySelector<HTMLButtonElement>("#schools-close")!.onclick = () => {
      close();
      document.querySelector<HTMLButtonElement>("#schools-open")?.focus();
    };
  };
  const close = () => {
    panel.hidden = true;
    document
      .querySelector("#schools-open")
      ?.setAttribute("aria-expanded", "false");
    selected = undefined;
    hooks.onSelect(undefined);
  };
  function render(focus?: string) {
    if (!data) return;
    const matches = filterSchools(data.schools, filters);
    const list = matches.slice(0, shown);
    frame(`<div class="eyebrow">OFFICIAL SCHOOL LOCATIONS</div><h2 tabindex="-1" id="schools-heading">Schools in the map area</h2>
      <p class="sold-scope">Open establishments from the Department for Education register, shown at their published locations. Distance is not a route, catchment or admission eligibility. No inspection ratings are included yet.</p>
      <label class="sold-search-label" for="schools-query">Search name, postcode or URN</label>
      <input id="schools-query" type="search" autocomplete="off" value="${e(filters.query)}" />
      <label class="sold-search-label" for="schools-phase">Phase of education</label>
      <select id="schools-phase"><option value="">All phases</option>${phases(
        data.schools,
      )
        .map(
          (p) =>
            `<option value="${e(p)}" ${p === filters.phase ? "selected" : ""}>${e(p)}</option>`,
        )
        .join("")}</select>
      <p id="schools-count" class="fine-note" role="status">${matches.length.toLocaleString("en-GB")} of ${data.schools.length} schools${matches.length > list.length ? ` · showing ${list.length}` : ""}</p>
      ${matches.length ? "" : '<p class="fine-note">No schools match. Establishments outside the map box or without a published location are not listed.</p>'}
      <ol class="school-list">${list.map((s) => `<li class="sold-record school-record${s.urn === selected ? " selected" : ""}" data-urn="${e(s.urn)}">${schoolRow(s)}<button class="secondary" data-school="${e(s.urn)}" aria-pressed="${s.urn === selected}">Show on map</button></li>`).join("")}</ol>
      ${matches.length > list.length ? '<button id="schools-more" class="secondary full">Show more schools</button>' : ""}
      ${schoolProvenance(data)}`);
    const query = panel.querySelector<HTMLInputElement>("#schools-query")!;
    query.oninput = () => {
      filters.query = query.value;
      shown = PAGE;
      render("#schools-query");
    };
    panel.querySelector<HTMLSelectElement>("#schools-phase")!.onchange = (
      event,
    ) => {
      filters.phase = (event.target as HTMLSelectElement).value;
      shown = PAGE;
      render("#schools-phase");
    };
    panel
      .querySelector<HTMLButtonElement>("#schools-more")
      ?.addEventListener("click", () => {
        shown += PAGE;
        render("#schools-more");
      });
    panel
      .querySelectorAll<HTMLButtonElement>("[data-school]")
      .forEach((button) => {
        button.onclick = () => {
          selected = button.dataset.school;
          hooks.onSelect(data!.schools.find((s) => s.urn === selected));
          render(`[data-school="${selected}"]`);
        };
      });
    if (focus) {
      const el = panel.querySelector<HTMLElement>(focus);
      el?.focus({ preventScroll: true });
      if (el instanceof HTMLInputElement)
        el.setSelectionRange(el.value.length, el.value.length);
    }
  }
  async function open() {
    beforeOpen();
    panel.hidden = false;
    document
      .querySelector("#schools-open")
      ?.setAttribute("aria-expanded", "true");
    if (!data) {
      frame(
        '<h2>Schools</h2><p role="status">Loading official school locations…</p>',
      );
      try {
        data = await loadSchools();
        hooks.onData(data);
      } catch {
        frame(
          '<h2>Schools</h2><p role="alert">School data could not load.</p><button id="schools-retry" class="secondary">Try again</button>',
        );
        panel.querySelector<HTMLButtonElement>("#schools-retry")!.onclick =
          () => void open();
        return;
      }
      // Closed while loading: leave it closed.
      if (panel.hidden) return;
    }
    render();
    panel.querySelector<HTMLElement>("#schools-heading")!.focus({
      preventScroll: true,
    });
  }
  /** Map click on a school marker. */
  function select(urn: string) {
    if (!data) return;
    const index = filterSchools(data.schools, filters).findIndex(
      (s) => s.urn === urn,
    );
    if (index >= shown) shown = index + 1;
    if (panel.hidden) {
      beforeOpen();
      panel.hidden = false;
    }
    selected = urn;
    hooks.onSelect(data.schools.find((s) => s.urn === urn));
    render();
    panel
      .querySelector(`[data-urn="${urn}"]`)
      ?.scrollIntoView({ block: "center" });
  }
  return { open, close, select, isOpen: () => !panel.hidden };
}
