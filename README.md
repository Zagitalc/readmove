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
- A streaming HM Land Registry CSV importer with corrections/deletions, file checksums, candidate-area filtering and documented coordinate joins. A reviewed 2025 residential subset is now bundled for address search; no geographic joins or automatic publication.
- Comparable-sale filters for distance, type and recency in the example UI; the shared engine also supports price limits and excludes future transactions and fixture/real-data mixing.
- Streamed nearby 3D building chunks, worker-generated geometry, mobile/desktop memory budgets, cancellation and explicit retry. Self-hosted vector buildings remain visible while detailed roofs load.
- Wider-area search across 49,490 names/addresses; a whole-area overview and visible loading/coverage status.
- A clearly marked example home with **fictional** transaction history and nearby sample sales. The records are manually associated with real footprints for demonstration; they are not facts about those buildings.
- A session-only, three-building comparison workflow. No tracking or persistent user profile.
- Optional illustrative population-density polygons and layer presets. These are **not official LSOAs or Census observations**.
- Local source/provenance panel, runtime building/transaction validation, unit tests and Playwright flows.

Coverage is `BOUNDS = [-1.08, 51.39, -0.84, 51.50]` in `shared/config.ts`, roughly 200 km². The configured zoom range is 11–19; the opening view is Reading station `[-0.9718, 51.4589]`, zoom 15.5, pitch 58°. MapLibre constrains the camera to the coverage box; viewport size can limit the effective furthest zoom.

Search the local names or a mapped address, try “Town Hall”, or choose **Explore an example**. Address coverage is incomplete. The `/` key focuses search; arrow keys and Enter select results. Escape closes contextual panels. Drag/scroll the map, use the zoom buttons, or switch between overhead and 3D perspective.

## What is real, and what is not?

**Real, mapped geography:** OSM-derived footprint and context data, source snapshot **4 September 2026**. OSM is incomplete and can be inaccurate. A tagged height is not independently verified by readmove.

**Illustrative:** inferred heights, roof geometry, windows and materials. There is no surveyed terrain or evidence for individual architectural details.

**Fictional development data:** all example sales, example property links, demo population counts and demo neighbourhood boundaries. The UI labels these wherever shown. No official property price or valuation is claimed.

**Not integrated:** HM Land Registry transactions, verified UPRNs, EPC/floor areas, ONS statistics, schools/Ofsted, flood mapping and authorised current listings. Missing records are shown as unavailable. See [data sources](docs/data-sources.md).

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run cf:check
```

On Linux CI, use `npx playwright install --with-deps chromium`. If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. Browser tests use software WebGL for repeatability, run desktop and mobile Chromium and keep traces on failure. They do not substitute for testing on physical phones.

## Cloudflare

`wrangler.jsonc` names the deployment **readmove** and uses Workers Static Assets. No D1 database or Worker API is needed yet. `npm run cf:check` performs a deployment dry run; it does not publish. To test locally, build first and run `npm run cf:dev`.

When **you** choose to deploy: `npx wrangler login`, then `npm run cf:deploy`. Use a new readmove Worker; do not point this configuration at Mini Reading. No Cloudflare account identifiers or credentials are included.

## Apply the delivered patches

See [local handoff](docs/local-handoff.md) for the **incremental stage-2 patch**, which applies after milestone 1. See [sold-price ingestion](docs/sold-prices.md) for the importer and [stage 2 / next stage](docs/next-stage.md) for scope and priorities. Nothing is committed or pushed by the implementation agent. You apply, review, commit and push from your own local folder.

## Architecture and roadmap

See [architecture](docs/architecture.md), [reference review](docs/reference-review.md), [data sources](docs/data-sources.md) and [verification](docs/verification.md).

Next milestones: ingest an actual monthly Price Paid release using the implemented importer; audit/verify UPRN links and publish a bounded sale index; bring in official statistical areas, school and environmental sources; add relevant-sale filters; selectively load glTF assets. National coverage, portal scraping, personal resident data, crime maps and household income inference are outside this prototype.

Application code is MIT under [LICENSE](LICENSE). Geography is a separate ODbL database; see [third-party notices](THIRD_PARTY_NOTICES.md). Mini Reading was inspected as a read-only architectural reference, not cloned or modified.

## Official sold prices

Open **Sold prices** for 6,325 real residential transactions from HM Land Registry's 2025 annual file in selected Reading-area postcode districts. Search addresses/postcodes and filter type/category. This is partial history, with no verified building links, map pins or valuation claims. The separate map demo remains fictional.

The official download succeeded on 3 October 2026. Source file updated 28 September 2026; 6,593 postcode candidates audited, 268 type Other excluded from the residential display. No paid data service, API key or live visitor API call is needed. [Reproduction, audit and licence details](docs/sold-prices.md).

## Official sale points and nearby transactions

All 100 officially matched UPRNs now have OS coordinates: **65 inside the map and 35 outside**. Open Sold prices → **Show verified sale points**; choose Both categories for all 65 points (the default Standard category has 51). Select a point or View location & nearby sales to compare mapped transactions by radius, date, type and category.

The other 6,225 residential transactions remain searchable without invented locations. Points are optional, source-linked and separate from OSM buildings. This sparse subset is not a valuation or full market coverage. [Source audit, limits and reproduction](docs/sale-coordinates.md).
