# Architecture

## Module boundaries

| Location                 | Responsibility                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `shared/config.ts`       | Region name, bounds, origin and initial camera                                      |
| `shared/types.ts`        | Data contracts and runtime validation                                               |
| `shared/geo.ts`          | Bounds, geographic distances and polygon matching with holes                        |
| `shared/integrations.ts` | Future identifier, school and flood-source contracts                                |
| `src/map`                | MapLibre style, camera, hit testing, layer visibility, local labels                 |
| `src/scene`              | Independent procedural geometry, Three.js shared-context rendering, selection       |
| `src/property`           | Property/transaction validation, local identity lookup, sample comparable selection |
| `src/neighbourhood`      | Explicitly fictional area polygons and area lookup                                  |
| `src/ui`                 | Shell, escaped source rendering, detail/comparison panels and keyboard search       |
| `scripts/geography`      | Pinned ODbL subset import and provenance hashes                                     |

No server or database is necessary for this milestone. Vite serves locally; Workers Static Assets serves the production build. No third-party data requests occur during ordinary exploration. The lockfile pins dependencies.

## Rendering

Self-hosted zoom-10–15 vector tiles drive MapLibre land, water, road, railway, footprint and fallback-extrusion layers. Local OSM rings are projected into east/north metres relative to the configured origin. Three.js renders merged wall, roof and window geometry using MapLibre's projection matrix and GL context. It repaints only when the map or state changes; there is no permanent animation loop. Geometry and materials are disposed on map removal.

Small, near-rectangular residential footprints can receive gables. A longest-edge reference orients the ridge. Roof triangles are split on the ridge so they form sloping planes instead of a jagged fan. Wall tops follow the same profile. Roofs remain within the supplied total building height. Flats, complex polygons, tall buildings, courtyards and unknown types use flat roofs. Window patterns are generic visual cues, not observations. Hipped roofs, chimneys, doors and boundaries are deferred.

Each resident chunk uses three merged geometry batches, plus a selected-building overlay. A per-triangle building reference supports actual mesh picking; MapLibre footprint picking provides the 2D fallback. The UI never treats an OSM building as a UPRN. An overhead camera remains selectable independently of whether the 3D layer is enabled.

The v2 manifest describes 97,355 building records in 1,237 chunks, 551 vector tiles and a small bootstrap of demonstration/landmark buildings. The source had 97,399 records; 44 whose footprint centres lie outside the configured bounds are excluded from the detail index. Search (49,490 named/addressed buildings) and the full ID lookup load only when needed. A six-chunk detail-record cache is independent of rendered geometry, and selected/saved records remain available after scene eviction.

At zoom 15+, two workers download/checksum-validate nearby chunks and generate transferable geometry buffers. Desktop limits are 32 chunks / 5,000 buildings / 96 MiB of accounted geometry and ID storage; mobile limits are 18 / 2,600 / 48 MiB. These are rendering budgets, not whole-browser memory claims. Chunk selection is nearest-first within the viewport. Moving out of coverage disposes geometry and aborts obsolete fetches; completed obsolete jobs are discarded. Failed jobs do not loop, and an explicit Retry control restarts them. Zooming out or disabling 3D evicts the detail working set.

Vector extrusions remain for buildings whose precise geometry is not resident. The filter excludes only successfully resident building IDs, so capped, loading and failed chunks retain simpler coverage. At zooms below 13 the map uses footprints. Ground elevation is flat. Physical device performance still needs measurement before enlarging coverage further. Rebuilds must publish a new versioned asset namespace when contents change; do not silently reuse immutable versions.

## Identity and provenance

`Building.id` identifies a mapped footprint. `PropertyLocation.id` identifies a property record and carries optional `uprn`, optional `buildingId`, a coordinate and an explicit match method. `Transaction.id` identifies a source transaction; `propertyRef` references the property record. Official transaction-to-UPRN joins and reviewed address-match candidates have separate contracts. Never silently resolve an unmatched historical address by choosing the nearest building.

Provenance includes source, source date, licence, optional URL and quality (`mapped`, `estimated`, `fixture`). Height provenance is additionally per building. UI-generated HTML escapes source strings; only HTTPS source links are rendered. Runtime validation rejects invalid coordinates, open rings, impossible heights, malformed dates, duplicate transaction IDs and nonpositive prices.

The current example explicitly uses `manual-fixture` locations, fictional transactions and no UPRN. Its nearby-sale demo uses straight-line distance and excludes the selected property. The shared comparable engine filters by straight-line radius, calendar-month age, type and optional price bounds, excludes the selected property and future-dated sales, and never mixes fixtures with non-fixtures. The UI exposes distance/type/age for the demo, with its fixed as-of date visible. No price adjustment or formal valuation is implied. Tenure, floor-area and reliable production matching remain future work. The PPD importer and explicit match contracts are described in `docs/sold-prices.md`.

## Area statistics

Point-in-polygon matching includes outer boundaries, excludes holes and returns an explicit missing result. Shared-boundary ties use source order; official data ingestion should detect overlaps and specify a consistent boundary rule. The two current demo rectangles and their populations are entirely fictional and are not LSOAs. Real ONS ingestion must retain geography codes, boundary edition, census year and denominator methodology.

## State and UX

Selection, map layers, the example workflow and up to three comparison IDs stay in memory. No cookies, analytics or storage are used. Search indexes only bundled names/addresses/IDs. Modes are layer presets; toggles override them. Official-data modes such as Schools and Environment are not shown until data exists.

Mobile detail panels occupy at most 53% of the viewport and scroll internally; close controls restore the map. Search supports arrow keys, Enter and Escape. A native dialog handles source notes and focus containment. A read-only test hook exists only in Vite development builds. Browser tests exercise real map rendering and selection, not a replacement mock map.

## Future Blender / glTF pipeline

Blender is **not** an MVP dependency. Future selective assets should follow:

1. Author in metres with a documented origin, orientation and ground reference.
2. Record asset licence, model quality, source geometry and explicit replacement OSM IDs.
3. Optimise topology/material count and export glTF/GLB.
4. Validate dimensions and coordinates; add meshopt/Draco and KTX2 only where measured savings justify their runtime cost.
5. Load near the camera with per-asset byte/triangle budgets and distance-based LOD; keep footprint/low-detail fallback while loading.
6. Dispose distant assets, cancel obsolete downloads and test phone memory/thermal behaviour.

Do not replace arbitrary nearby buildings with a landmark model. The objective is believable spatial context, not house-by-house photorealism.

## Official residential sale display

The separately lazy-loaded `sales-2025.v1.json` contains 6,325 real residential transaction records with shared source metadata. `shared/published-sales.ts` validates count, ID and postcode consistency. `src/property/sold-prices.ts` filters address/type/category; `src/ui/sold-prices.ts` renders a responsive side panel/bottom sheet in batches of 20. Text is escaped, source URLs are constrained by schema, and a failed load can be retried on reopening. No coordinates, property IDs or map pin callbacks exist in this contract, so it cannot accidentally substitute a transaction for the selected building. The official source is kept separate from fictional comparable examples.

`scripts/property/prepare.ts` checks the reviewed source checksum and re-parses the original CSV to verify the candidate snapshot before preparing a residential asset. Each refresh needs explicit scope, source-date evidence and a versioned file. National CSVs are not sent to visitors.

## Optional real sale points

`src/property/located-sales.ts` joins exact transaction → UPRN → official point references and returns only points within REGION.bounds. `src/map/sales.ts` owns disposable accessible markers and never calls building selection. `src/ui/sold-prices.ts` synchronises optional markers, panel selection and comparison filters using the existing source-aware comparable engine. Closing the panel clears markers; late data loads do not reopen a closed panel. Marker actions preserve separate sale identity, and no point is assigned to an OSM footprint. Coordinates are loaded from the versioned v2 manifest and cross-checked against the exact price-asset checksum. The legacy v1 identifier snapshot is retained for reproducible extraction.
