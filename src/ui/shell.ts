export const icon = (
  name: "search" | "home" | "layers" | "arrow" | "close" | "pin",
) => {
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    home: '<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
    layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};
export function shell(): void {
  document.querySelector("#app")!.innerHTML = `
    <main id="map" aria-label="Reading property map"></main>
    <a class="skip-link" href="#search">Skip to property search</a>
    <header class="topbar">
      <a href="/" class="brand" aria-label="readmove home"><span class="brand-mark">${icon("home")}</span><span>read<span class="brand-light">move</span><small>UNDERSTAND THE PLACE</small></span></a>
      <div class="search-wrap"><span>${icon("search")}</span><input id="search" type="search" placeholder="Find a place or mapped building" autocomplete="off" aria-label="Search places and buildings" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results"/><kbd>/</kbd>
        <div id="search-results" role="listbox" aria-label="Search results" hidden></div></div>
      <span class="region">${icon("pin")} Reading <span>· Berkshire</span></span>
      <button id="compare-open" class="compare-button" aria-label="Open saved building comparison">Compare <span id="compare-count">0</span></button>
    </header>
    <nav class="modes" aria-label="Map modes">
      <button data-mode="explore" aria-pressed="true">Explore</button>
      <button data-mode="property" aria-pressed="false">Property</button>
      <button data-mode="neighbourhood" aria-pressed="false">Neighbourhood <span class="tiny-tag">DEMO</span></button>
      <button id="sold-open" aria-expanded="false" aria-controls="official-sales">Sold prices</button>
    </nav>
    <aside id="intro" class="intro">
      <div class="eyebrow"><span class="dot"></span> A CLOSER LOOK AT READING</div>
      <h1>A home is more<br>than four walls.</h1>
      <p>Explore the buildings.<br>Get a feel for the neighbourhood.<br>See the place around a home.</p>
      <button id="example" class="primary">Explore an example ${icon("arrow")}</button>
      <span class="intro-foot">Real geography. Clearly labelled sample sales.</span>
      <div class="intro-divider"></div>
      <span class="map-hint">Click a building to take a closer look.</span>
    </aside>
    <section id="details" class="details" aria-label="Building details" hidden></section>
    <section id="official-sales" class="details" aria-label="Official sold prices" hidden></section>
    <section id="comparison" class="details" aria-label="Saved building comparison" hidden></section>
    <div class="map-controls">
      <button id="layers-button" aria-label="Map layers" aria-expanded="false" aria-controls="layers-panel">${icon("layers")}</button>
      <div class="control-stack"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button></div>
      <button id="tilt" aria-label="Toggle 3D perspective" aria-pressed="true">3D</button>
      <button id="north" aria-label="Reset bearing to north" class="north">↑<small>N</small></button>
      <button id="overview" aria-label="Show entire map area" title="Show entire area">⛶</button>
      <button id="home-view" aria-label="Return to Reading overview">${icon("home")}</button>
    </div>
    <section id="layers-panel" class="layers-panel" aria-label="Map layer settings" hidden>
      <h2>Make it your map</h2>
      <label>3D buildings<input type="checkbox" id="layer-buildings" checked /></label>
      <label>Place labels<input type="checkbox" id="layer-labels" checked /></label>
      <label>Area density <span class="tiny-tag">DEMO</span><input type="checkbox" id="layer-neighbourhood" /></label>
      <p>Area boundaries and population are illustrative, not Census data.</p>
    </section>
    <div id="area-legend" class="area-legend" hidden><strong>Illustrative population density</strong><span><i></i> Lower <i></i> Higher</span><small>Fictional areas · not LSOAs or resident data</small></div>
    <div class="place-dock" aria-label="Explore local places"><span>TAKE A LOOK AROUND</span><div id="place-buttons"></div></div>
    <div class="stream-status"><span id="detail-status" role="status">Loading nearby building detail…</span><button id="retry-detail" hidden>Retry detail</button></div>
    <footer class="map-footer"><span class="dot"></span><span id="geography-status">Loading local geography…</span><button id="about">Sources &amp; notes ↗</button></footer>
    <div id="loading" class="loading" role="status"><span class="loader"></span><strong>Getting to know Reading</strong><span>Loading the local map</span></div>
    <div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
    <dialog id="sources-dialog"><button id="sources-close" class="close-button" aria-label="Close sources">${icon("close")}</button><div id="sources-content"></div></dialog>
  `;
}
export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
let noticeTimer: ReturnType<typeof setTimeout>;
export function notice(message: string): void {
  const el = document.querySelector<HTMLElement>("#notice")!;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
}
