# readmove

**Understand the home. Understand the place.**

A separate, map-first property and neighbourhood research prototype for Reading, Berkshire. It explores building mass and surrounding streets, railway lines, water and open space. It is not a listings portal, valuation service or digital survey.

## Run locally

Use **Node.js 24+** (see `.nvmrc`). No account, map token, database or API key is required.

```sh
npm ci
npm run dev
```

Vite serves port 5173. Geography is already bundled. For a production build, run `npm run build` then `npm run preview`. The application requires WebGL2; startup failures show a retry message rather than a silent blank map.

## Current milestone

- 97,355 real OpenStreetMap building records across greater Reading, with self-hosted roads, railways, water and land context.
- A new TypeScript/Vite application using MapLibre GL JS and a shared-context Three.js building layer. No React.
- Restrained light map styling, sparse local labels, keyboard search, clickable buildings and desktop/mobile detail panels.
- Source height precedence: tagged height → mapped storeys × 3 m → deterministic building-category estimate. Each selection identifies the basis. Small suitable residential footprints receive procedural pitched roofs and illustrative windows; complex footprints retain flat roofs and courtyards.
- Explicit separation of mapped building identity, property identity, UPRN joins and transactions.
- A streaming HM Land Registry CSV importer with corrections/deletions, file checksums, candidate-area filtering and documented coordinate joins. A reviewed 2025 residential subset is now bundled for address search, with a separate official transaction → UPRN → OS coordinate join. No automatic publication.
- Real nearby-sale filters for radius, type, category and date, plus an explicit fit action; the shared engine also supports price limits and excludes future transactions and fixture/real-data mixing.
- Streamed nearby 3D building chunks, worker-generated geometry, mobile/desktop memory budgets, cancellation and explicit retry. Self-hosted vector buildings remain visible while detailed roofs load.
- Wider-area search across 49,490 names/addresses; a whole-area overview and visible loading/coverage status.
- A clearly marked example home with **fictional** transaction history and nearby sample sales. The records are manually associated with real footprints for demonstration; they are not facts about those buildings.
- A session-only, three-building comparison workflow. No tracking or persistent user profile.
- Optional illustrative population-density polygons and layer presets. These are **not official LSOAs or Census observations**.
- Local source/provenance panel, runtime building/transaction validation, unit tests and Playwright flows.

Coverage is `BOUNDS = [-1.08, 51.39, -0.84, 51.50]` in `shared/config.ts`, roughly 200 km². The configured zoom range is 11–19; the opening view is Reading station `[-0.9718, 51.4589]`, zoom 15.5, pitch 58°. Normal exploration constrains the camera to the coverage box; viewport size can limit the effective furthest zoom. Sale fitting temporarily relaxes camera limits to frame points around panels, restoring normal limits on exit; data coverage is unchanged.

Search the local names or a mapped address, try “Town Hall”, or choose **Explore an example**. Address coverage is incomplete. The `/` key focuses search; arrow keys and Enter select results. Escape closes contextual panels. Drag/scroll the map, use the zoom buttons, or switch between overhead and 3D perspective.

## What is real, and what is not?

**Real, mapped geography:** OSM-derived footprint and context data, source snapshot **4 September 2026**. OSM is incomplete and can be inaccurate. A tagged height is not independently verified by readmove.

**Illustrative:** inferred heights, roof geometry, windows and materials. There is no surveyed terrain or evidence for individual architectural details.

**Fictional development data:** all example sales, example property links, demo population counts and demo neighbourhood boundaries. The UI labels these wherever shown. No official property price or valuation is claimed.

**Official observations:** 6,325 residential Land Registry transactions, 246 exact official UPRN joins and 177 transactions at OS coordinates inside the map. These are separate from fictional examples and have no verified building links.

**Not integrated:** EPC/floor areas, ONS statistics, schools/Ofsted, flood mapping and authorised current listings. Missing records are shown as unavailable. See [data sources](docs/data-sources.md).

## Verify

```sh
npm test
python3 -m unittest discover -s tests/unit -p 'test_*.py'
npm run build
npx playwright install chromium
npm run test:browser
npm run cf:check
```

On Linux CI, use `npx playwright install --with-deps chromium`. If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. Browser tests use software WebGL for repeatability, run desktop and mobile Chromium and keep traces on failure. They do not substitute for testing on physical phones.

## Cloudflare

`wrangler.jsonc` names the deployment **readmove** and uses Workers Static Assets. No D1 database or Worker API is needed yet. `npm run cf:check` performs a deployment dry run; it does not publish. To test locally, build first and run `npm run cf:dev`.

When **you** choose to deploy: `npx wrangler login`, then `npm run cf:deploy`. Use a new readmove Worker; do not point this configuration at Mini Reading. No Cloudflare account identifiers or credentials are included.

## Local development handoff

See [local handoff](docs/local-handoff.md) for the verified starting Git state, current changes and checks. See [sold-price ingestion](docs/sold-prices.md) and [identifier/coordinate reproduction](docs/uprn-matching.md). Nothing is committed, pushed or deployed by this implementation.

## Architecture and roadmap

See [architecture](docs/architecture.md), [reference review](docs/reference-review.md), [data sources](docs/data-sources.md) and [verification](docs/verification.md).

Next milestones: reproducible monthly refreshes with coverage reports; richer comparable exploration and exact identity sources; official area statistics, schools and environment context; measured rendering and mobile improvements. See the ordered [roadmap](docs/next-stage.md). National coverage, portal scraping, personal resident data, crime maps and household income inference are outside this prototype.

Application code is MIT under [LICENSE](LICENSE). Geography is a separate ODbL database; see [third-party notices](THIRD_PARTY_NOTICES.md). Mini Reading was inspected as a read-only architectural reference, not cloned or modified.

## Official sold prices

Open **Sold prices** for 6,325 real residential transactions from HM Land Registry's 2025 annual file in selected Reading-area postcode districts. Search addresses/postcodes and filter type/category. This is partial history, with official OS map points for matched in-bounds sales, no verified building links and no valuation claims. The separate map demo remains fictional.

The official download succeeded on 3 October 2026. Source file updated 28 September 2026; 6,593 postcode candidates audited, 268 type Other excluded from the residential display. No paid data service, API key or live visitor API call is needed. [Reproduction, audit and licence details](docs/sold-prices.md).

## Official UPRN matching

July and August 2026 official monthly lookups provide **246 exact transaction-to-UPRN matches** (245 distinct UPRNs), up from 100 August identifiers in the local starting checkout. The September 2026 OS Open UPRN release supplies coordinates for all 246 transactions: **177 in bounds**, 69 outside. Its snapshot/extraction date is **14 August 2026**, distinct from the release month. The independently measured August-only in-bounds count is 65.

Try **Sold prices → RG1 4PF → Show mapped sale**. Selection clears address search before calculating comparisons and preserves type/category/radius/date filters. **Fit nearby sales** frames the selected point and all filtered comparisons within the unobscured map; no matches still fits the selection. The mobile close control stays fixed while panel content scrolls. Back returns to address search.

The 6,079 unmatched transactions remain searchable. Monthly lookups are not a complete historical archive. Identical pairs deduplicate; conflicts retain evidence and are excluded as ambiguous. No sale uses a postcode centroid or arbitrary building. [Counts, source checksums, dates and reproduction](docs/uprn-matching.md).

## Integration with stage-6

Reconciled the existing stage-6 coordinate implementation with the expanded lookup and browser-flow work. The original 100-coordinate audit and extractor, coordinate validation and map attribution are retained. The app uses one current renderer/schema path, with optional map points (off by default), an in-map-only filter, grouped co-located sales, exact date filtering, query clearing and explicit fit. The original relative transaction-age selector is superseded by the explicit “Sold on or after” date filter. Earlier verification above describes the pre-merge work; merge-specific checks are recorded in the handoff.
