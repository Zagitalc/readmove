# Stage 6 — verified coordinates and optional map points

- OS official API/archive download succeeded over verified HTTPS. Archive length 619,271,161 bytes and publisher MD5 `1d5c21d8166d6efd74850ec6f1ae77ab` match; recorded SHA-256 is `107503d45bedaab7f74511766eedbd617f9ca3592113363711e94f4b6458d55a`.
- September 2026 release reports extraction date 14 August 2026 in versions.txt. The archive notice and native CSV schema were inspected; no datum transformation or building assignment was made.
- Two separate full CSV scans agree on all 100 requested UPRN coordinates across 41,676,575 rows. Zero missing/conflicting/duplicate matched rows; 65 inside map bounds and 35 outside. Only matched rows are bundled.
- 38 unit tests pass, including GB coordinate order/range, source evidence, true map bounds, source-preserving located-sale joins and real nearby-distance expectations.
- Full 22-case desktop/mobile browser suite passes. Optional points, exact category counts (51 standard / 65 both), official selection, nearby filters, clearing markers and fixture separation are covered. Additional targeted verification exercises keyboard marker selection with a fixed test date.
- Production TypeScript/Vite build passes. Existing bundle-size/vector-tile-version warnings remain. Physical-device performance and survey-grade positional accuracy are not claimed.
- Incremental stage-6 patch is checked and applied against the saved stage-5 baseline, then compared byte-for-byte. National archives/raw CSVs are excluded. No commits, pushes or deployments.

---

# Stage 5 — exact UPRN identifiers, coordinates pending

- Downloaded and validated all 84,149 rows of the official August 2026 transaction-to-UPRN CSV. Its pinned SHA-256 and provenance accompany the versioned join asset.
- 100 exact matches to the 6,325 residential sales; 6,225 unmatched, zero conflicting or duplicate matched rows. An independent Python CSV check confirmed all 100 published pairs. Regeneration is byte-identical.
- 35 unit tests pass; production TypeScript/Vite build passes with the existing size warning. Tests include ambiguous IDs, malformed UPRNs, source failures and rejection of coordinates without evidence.
- Eight relevant desktop/mobile browser checks pass: sold-price search, load recovery, UPRN filtering/details, and rejection/recovery of a lookup with the wrong sales-file hash. Unchanged map regression flows were last fully run at stage 4.
- `www.ordnancesurvey.co.uk` and `api.os.uk` requests return proxy HTTP 403. Saved network additions have not enabled runtime access. No OS coordinate file, real sale map pins or real distance-based comparisons are claimed.
- Incremental handoff applies after stage 4 (including the equivalent combined 3-and-4 patch); packaging checks clean application and byte equality. No commits, pushes or deployments.

---

# Stage 4 — real official-source data

- Downloaded the official 2025 annual Price Paid CSV over verified HTTPS on 3 October 2026: 169,648,191 bytes; source file Last-Modified 28 September 2026. Source SHA-256 and publisher links accompany the bundled audit.
- Streamed 974,087 rows; retained 6,593 postcode candidates, all unlocated. Type Other exclusion leaves 6,325 residential display records. Independent Python CSV comparison verified every retained ID/price/date/postcode, with zero mismatches or duplicate retained IDs.
- Reviewed GOV.UK download, yearly, field-definition and transaction-to-UPRN pages. Address-display conditions and OGL attribution are retained. The National Archives OGL page itself returned HTTP 403; publisher licence conditions were readable.
- Rebuilt the residential asset from the pinned raw CSV, revalidated snapshot records/audit and obtained byte-identical output. National CSV remains ignored.
- 32 unit tests pass. TypeScript and Vite build pass; the existing bundle-size warning remains.
- 16 desktop/mobile browser tests pass, covering map regression, real address/type/category search, no camera movement, viewport bounds, source attribution and failed-load recovery.
- The handoff patch is checked against the preserved stage-3 baseline, applied to a temporary copy and compared byte-for-byte with the deliverable. Nothing committed, pushed or deployed.

Earlier checks below are historical evidence, not the current source availability status.

---

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

## Stage 3 — official source workflow

- 30 unit tests pass, including source URL/scope validation, monthly-baseline/date checks, receipt consistency, row-level import auditing and explicit unmatched coverage.
- TypeScript and production Vite build pass. The existing bundle-size warning remains.
- CLI help runs. A separate synthetic transport smoke check exercised annual download/import/receipt/audit, monthly correction with retained baseline, existing-output refusal and malformed-input cleanup. This does not verify the live publisher schema or current terms.
- Actual official-host access fails with proxy HTTP 403. The failed CLI download leaves neither an output dataset nor temporary files. No official release/date/terms or actual sale records were verified.
- Browser flows were not rerun for this data-tooling-only change; no browser or map code changed. Stage-2 browser evidence remains above.
- The patch is incremental against stage 2; clean application and byte comparison are checked during packaging. No commit, push or deployment.
