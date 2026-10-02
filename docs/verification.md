# Verification

Validated in the cloud workspace using Node 24.19.0, npm 11.9.0 and system Chromium with Playwright's software WebGL configuration.

- Frozen dependency reinstall: `npm ci --include=dev --cache /tmp/readmove-npm`.
- 25 Vitest checks: all bundled footprints, bounds/invalid coordinates, polygon holes and edges, area matching, separate property/transaction identity, invalid transaction fields, duplicates, comparable radius, height/source labelling, safe source rendering procedural roof geometry, chunk budgets/transforms, PPD corrections/deletions/idempotence/read failures, explicit matches and source-aware comparable filters.
- 12 Playwright cases: six flows each in desktop Chromium (1440 × 1000) and mobile Chromium (Pixel 7 viewport). They cover real WebGL rendering without external requests, search with keyboard selection, actual 2D footprint and 3D roof clicks, layer overrides, fictional transaction labels, comparable selection, comparison removal, mobile panel geometry, source dialog contents, outlying address lookup, complete overview tile loading, eviction, budgets and failed-download recovery.
- TypeScript checking and Vite production build.
- `wrangler deploy --dry-run`: static asset deployment configuration validates without publishing.
- Local Cloudflare runtime: HTTP 200, content security policy present, real map and sample-sale interaction succeed, no browser console/page errors, development test hook absent.
- Pinned geography import with source checksum validation: 97,355 footprint records, 1,237 chunks, 551 tiles and 49,490 search entries. Source checksums are preserved.
- Patch checked and applied to a clean copy of the milestone-1 baseline; created files compared byte-for-byte with the working source. No agent commit or push.

Screenshots were inspected for desktop/mobile overview and selected-building layouts. Browser results and traces are generated under ignored `test-results/`, not included in the source patch.

## Scope and remaining limits

Tests use Chromium and software WebGL. Safari, Firefox, physical phones, production Cloudflare account limits, GPU memory/thermal performance and live public deployment have not been verified. WebGL2 is required; there is a startup error/retry state, not a complete non-WebGL renderer.

The approximately 1.6 MB uncompressed application bundle (about 424 kB gzip), plus MapLibre's worker, a 187 kB geometry worker and the local geography, triggers Vite's default chunk-size warning. MapLibre and Three.js dominate the entry. This is recorded as an optimisation opportunity, not suppressed. The roughly 101 MB geographic asset set is now streamed rather than fetched at startup. A representative station view retained about 31 MB of accounted geometry across 32 chunks. This excludes browser, GPU-driver, source-cache and temporary worker memory and is not a physical-device benchmark.

Wrangler's local runtime could not fetch external `Request.cf` metadata through the cloud proxy and used its documented placeholder; this static application does not consume that metadata. The live Mini Reading reference URL, Geofabrik and Overpass were blocked by the build environment. Individual GitHub source files and the pinned ODbL redistribution were accessible.

No official transaction/UPRN/EPC/Census/school/flood integrations are claimed. Those are documented extension points; fixture data remains visibly fictional. Nothing was published or deployed to a remote Cloudflare account.

The sold-price CLI was additionally exercised with an explicitly fictional CSV outside the public asset tree: it retained one candidate, reported zero geographic matches and did not infer a building. Actual national/monthly publisher files, genuine identifier-match quality, official sale publication and production deployment remain untested. The full browser suite passed; the strengthened overview readiness checks were rerun on both desktop and mobile after inspection of an early-loading screenshot.
