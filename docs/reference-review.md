# Reference review before implementation

Reference: [Mini Reading 3D](https://github.com/Zagitalc/mini-reading-3d), revision `475453a10c674ece44f566120ec43e4491cddf32` for the pinned geography redistribution. Individual public source files were inspected over HTTPS; no reference repository was cloned, checked out or changed.

Reviewed: README, package manifest, `docs/architecture.md`, `docs/cloudflare.md`, `src/main.ts`, `src/map/style.ts`, `src/scene/layer.ts`, `src/style.css`, `src/ui/shell.ts`, shared configuration/types, OSM extraction/build scripts, geography manifest/chunk structure, `wrangler.jsonc` and third-party notices. The live site was blocked by the cloud egress policy, so visual conventions were inspected through source CSS and UI code; no live-site screenshot comparison is claimed.

## Ideas retained

- Local-first, bounded geography and source timestamps. Generate static assets before visitors arrive.
- MapLibre handles the ground map, navigation and geographic camera; one Three.js custom layer shares its WebGL context.
- Metric geometry relative to a geographic origin, transformed into Web Mercator.
- Height precedence and explicit uncertainty. Neutral walls, restrained roofs, pale water, quiet roads.
- Compact controls and local search, with the map occupying most of the screen.
- Cloudflare Static Assets for self-contained deployment.

## Intentional differences

- Fresh application source and product identity: readmove. No transport polling, live vehicles, roadworks ingestion, credentials or copied reference application modules.
- Property research uses separate building, property and transaction identities. There is no proximity-based assertion that a dwelling or UPRN belongs to a footprint.
- Desktop detail panel and a mobile bottom sheet. Building comparisons and source explanations replace live-feed dashboards.
- Milestone 1 bundled a small central snapshot. Stage 2 expands to the requested greater Reading box with 97,355 detail records and independently implemented worker streaming, budgets and fallback extrusions. The reference's custom landmark replacement system is not reused.
- No D1 yet. A database should be introduced with an actual bounded transaction query and refresh requirement.
- A conservative independent gable algorithm triangulates the real footprint and splits triangles along an oriented ridge. Courtyards and complex footprints use flat roofs. Upstream inferred roof names are discarded.

## Geography reuse, separately from code

Geofabrik and Overpass endpoints were blocked in the build environment. The reference publishes its derived OSM database under ODbL 1.0. The importer extracts a bounded subset of that **data**, pins the redistribution revision, retains source timestamps and identifiers, and records SHA-256 hashes. No custom landmark geometry, transport data, font assets or reference application code is bundled. Context remains in self-hosted vector tiles at zooms 10–15; footprints use the precise published building rings.

The medium-term geography pipeline should read Geofabrik PBF directly, retaining raw height, roof, address and building-type tags through validation. This avoids relying on another application's derived schema.
