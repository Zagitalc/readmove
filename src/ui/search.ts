import type { SearchBuilding, Place } from "../../shared/types";
import { buildingTitle } from "../property/data";
import { escapeHtml } from "./shell";

export function connectSearch(
  getBuildings: () => Promise<SearchBuilding[]>,
  places: Place[],
  onBuilding: (id: string) => void,
  onPlace: (place: Place) => void,
  onExample: () => void,
): void {
  const input = document.querySelector<HTMLInputElement>("#search")!;
  const results = document.querySelector<HTMLElement>("#search-results")!;
  let choices: { title: string; subtitle: string; choose: () => void }[] = [],
    active = -1;
  const close = () => {
    request++;
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const select = (index: number) => {
    const choice = choices[index];
    if (choice) {
      input.value = choice.title;
      choice.choose();
      close();
    }
  };
  const highlight = () => {
    results
      .querySelectorAll("[role=option]")
      .forEach((el, i) =>
        el.setAttribute("aria-selected", String(i === active)),
      );
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", `result-${active}`);
      document
        .getElementById(`result-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };
  let request = 0;
  input.addEventListener("input", async () => {
    const version = ++request;
    const query = input.value.trim().toLocaleLowerCase("en-GB");
    active = -1;
    input.removeAttribute("aria-activedescendant");
    results.replaceChildren();
    choices = [];
    if (!query) {
      close();
      return;
    }
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    results.textContent = "Searching local buildings…";
    let buildings: SearchBuilding[];
    try {
      buildings = await getBuildings();
    } catch {
      if (version === request)
        results.textContent =
          "Search data could not load. Edit the search to retry.";
      return;
    }
    if (version !== request) return;
    results.replaceChildren();
    if ("example property demo sample".includes(query))
      choices.push({
        title: "Example property",
        subtitle: "Fictional sales on a real footprint",
        choose: onExample,
      });
    for (const p of places
      .filter((p) => p.name.toLocaleLowerCase("en-GB").includes(query))
      .slice(0, 4)) {
      choices.push({
        title: p.name,
        subtitle: `Mapped ${p.kind}`,
        choose: () => onPlace(p),
      });
    }
    for (const b of buildings
      .filter((b) =>
        `${b.name ?? ""} ${b.address ?? ""} ${b.id}`
          .toLocaleLowerCase("en-GB")
          .includes(query),
      )
      .slice(0, 8 - choices.length)) {
      choices.push({
        title: buildingTitle(b),
        subtitle: `OSM ${b.kind.replaceAll("_", " ")} · ${b.id}`,
        choose: () => onBuilding(b.id),
      });
    }
    if (!choices.length)
      results.innerHTML =
        "<p>No mapped matches in this greater Reading snapshot. Try “Reading” or “example”. This is not a complete address directory.</p>";
    for (const [i, choice] of choices.entries()) {
      const button = document.createElement("button");
      button.id = `result-${i}`;
      button.role = "option";
      button.tabIndex = -1;
      button.setAttribute("aria-selected", "false");
      button.innerHTML = `${escapeHtml(choice.title)}<small>${escapeHtml(choice.subtitle)}</small>`;
      button.addEventListener("click", () => select(i));
      results.append(button);
    }
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!choices.length) return;
      active =
        (active + (event.key === "ArrowDown" ? 1 : -1) + choices.length) %
        choices.length;
      highlight();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      select(active < 0 ? 0 : active);
    }
  });
  document.addEventListener("click", (event) => {
    if (!(event.target as Element).closest(".search-wrap")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !(event.target instanceof HTMLInputElement) &&
      !document.querySelector("dialog[open]")
    ) {
      event.preventDefault();
      input.focus();
    }
  });
}
