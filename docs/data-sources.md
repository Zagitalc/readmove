# Data sources and integration plan

## Implemented

| Dataset                                                                  | Coverage / version                                          | Use and limits                                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenStreetMap via Geofabrik; redistributed ODbL subset from Mini Reading | `[-1.08, 51.39, -0.84, 51.50]`; source 2026-09-04T20:21:21Z | 97,355 footprint records in 1,237 chunks, building types, some names/addresses, source height classification; roads, railway, water and land context |
| HM Land Registry Price Paid                                              | 2025 annual residential subset                              | 6,325 real transactions; postcode candidates, partial history                                                                                        |
| HMLR transaction-to-UPRN                                                 | July + August 2026                                          | 246 exact pairs / 245 UPRNs; per-match release evidence, no conflicts observed                                                                       |
| OS Open UPRN                                                             | September 2026 release; 14 August snapshot                  | Coordinates for 246 transactions; 177 in bounds, 69 outside; no building links                                                                       |
| ONS LSOA (December 2021) BGC V5 + Census 2021 TS001/TS006                | 217 LSOAs intersecting the map box; retrieved 2026-10-17    | Area-level usual residents and published residents per km² for 21 March 2021. Generalised boundaries; not resident or property characteristics       |
| DfE Get Information about Schools (GIAS)                                 | Extract 2026-10-18; 151 open establishments in the map box  | Official names, types, phases, statutory ages and locations. No inspection data; proximity is not eligibility                                        |
| readmove development fixtures                                            | 2026-10-02; CC0                                             | Three fictional property links and four transactions. Clearly marked; not official observations                                                      |

The source contains 44 additional footprints whose centres lie outside the box; these have no selectable detail records in this release. Some boundary geometry in vector tiles can extend slightly across the edge.

The complete derived database is distributed as `public/data/geography.v2.json` and `public/data/v2/` under ODbL 1.0. `public/data/provenance.json` identifies every imported input and checksum, the exact redistribution revision and the upstream source timestamp. Building footprints retain published precision; context remains in 551 self-hosted vector tiles and retains their quantisation/clipping. Mapped addresses are incomplete. Raw OSM height tags and exact architectural roof observations are not retained in the upstream compact footprint data.

Height precedence in that source is tagged height, otherwise storeys × 3 metres, otherwise a building-type fallback (typically 7 m for other buildings, 13 m for apartments/commercial/retail/office, 9 m for industrial/warehouse). Tagged height and storeys are OSM observations, not readmove surveys. Inferred colours, roofs and windows carry no claim of architectural accuracy.

### Rebuild the pinned subset

```sh
npm run data:geography
npm test
npm run build
```

Requires Node 24 and `curl`. The importer downloads only from `raw.githubusercontent.com` at the pinned revision, caches inputs under ignored `raw/geography`, verifies them against bundled SHA-256 hashes, validates footprints and writes the compact database. It does not clone Mini Reading. Preserve TLS/checksum verification. To stage output instead of replacing the bundle:

```sh
GEOGRAPHY_OUTPUT=raw/staging npm run data:geography
```

Inspect changes before promoting staged files. The current pinned import is repeatable but is **not a freshness update**. A future direct Geofabrik PBF extraction should assemble polygons with holes, preserve raw source tags and timestamps, clip to configured coverage, reject invalid geometry, validate IDs/counts/bounds and publish a new versioned manifest. Do not query national geography APIs for every visitor.

## Historic sold prices (implemented)

`npm run data:sales` validates user-supplied HM Land Registry CSVs, applies A/C/D updates, retains unmatched candidates, and accepts explicit documented coordinate links. Nothing is downloaded, joined to OSM by proximity, or published automatically. See [sold-price ingestion](sold-prices.md). The Sold prices panel separately displays 6,325 reviewed residential transactions from the 2025 annual file; map examples remain fictional.

## Planned: legitimate public dataset connections

| Source                                                                                                                                                                                 | Intended integration                                                                               | Refresh / caution                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Further years of HM Land Registry Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads)                                                     | Historic sale transactions, independent transaction IDs, published property-type and tenure fields | Monthly bounded extraction; preserve corrections/deletions and transaction categories. Not a complete inventory of homes or market valuations. Confirm current licence and required acknowledgement before redistribution. |
| [Further HM Land Registry UPRN lookup information](https://www.gov.uk/government/organisations/land-registry) + [OS Open UPRN](https://www.ordnancesurvey.co.uk/products/os-open-uprn) | Optional verified transaction → UPRN → coordinate joins, with matching provenance                  | Check product availability, coverage and terms. Older/unmatched transactions remain unmatched. OS Open UPRN is a coordinate identifier product, not a free full address directory or property boundary.                    |
| [EPC Open Data](https://epc.opendatacommunities.org/)                                                                                                                                  | Certificate rating, floor area, certificate date and usable identifier links                       | Access and licensing review required. Multiple certificates and measurement definitions need reconciliation. Never derive price/m² without a suitable area and transaction.                                                |
| [ONS Census](https://www.ons.gov.uk/census) / [ONS Open Geography](https://geoportal.statistics.gov.uk/)                                                                               | Further Census 2021 topics for the bundled LSOAs: age, tenure, households and car access           | Versioned census/statistical geography. Preserve denominators and boundary edition; population change needs comparable boundaries. All statistics are area-level, not resident or property characteristics.                |
| [DfE Get Information about Schools](https://get-information-schools.service.gov.uk/) (locations implemented; closures/mergers via periodic extracts)                                   | Establishments, URNs, status, phase, age range and locations                                       | Periodic source version; detect closed/merged schools. Straight-line distance is not a route or admission eligibility.                                                                                                     |
| [Ofsted](https://www.gov.uk/government/organisations/ofsted)                                                                                                                           | Published inspection information and report links                                                  | Preserve inspection/publication dates and framework. Do not reduce different inspection frameworks to a fabricated comparable score.                                                                                       |
| [Environment Agency data](https://environment.data.gov.uk/)                                                                                                                            | River/sea flood areas; separately, surface-water datasets where licensed                           | Preserve official classification, source layer and edition. A mapped polygon intersection is not a survey, insurance quote or property-specific risk rating. Check each product's licence and permitted display.           |

Official transaction → UPRN → OS coordinate joins now supply 177 in-bounds transaction markers. No verified OSM building associations exist. Transactions, identifiers and coordinates remain separate. There is no hidden scraping pipeline. The fixture example illustrates the contracts only.

## Experimental / future

Procedural hipped roofs, explicit semi-detached/terrace component models and selective Blender GLBs need reliable building types and geometry. Do not infer a count of separate dwellings from a joined terrace footprint. Property boundaries/gardens require reliable source geometry and appropriate licensing. Catchments require authoritative boundaries and academic years. None is presented as implemented.

## Unavailable without an authorised provider

Current estate-agent listings, asking-price changes and listing photography need a licensed or otherwise authorised source. `ListingProvider` is an unimplemented interface, not a scraper. Rightmove and Zoopla are not queried. Address products beyond open UPRN coordinates may also need a licence; do not treat a future plan as permission to redistribute them.

## Privacy and interpretation

No personal occupant records, resident profiles, private household income estimates, crime maps or tracking. No formal valuations. Only aggregate neighbourhood statistics at their documented scale should be integrated. Each new dataset must expose its own provenance and date in the relevant panel, and unavailability must remain distinct from zero observations.

## Official PPD acquisition status (historical stage 4; subsequent joins below)

Implemented: `scripts/property/official.ts` downloads supported official HTTPS CSVs, retains a SHA-256 receipt and generates an import/coverage audit. Monthly changes require an earlier annual/complete baseline. The reviewed 2025 residential asset is incorporated separately from raw acquisition output.

Downloaded and audited on 3 October 2026: 974,087 national rows; 6,593 retained postcode candidates; 6,325 residential display records after excluding type Other. Source file Last-Modified: 28 September 2026. No coordinate matches. See [the source audit and reproduction guide](sold-prices.md). The regional asset and audit are bundled; original national data stays ignored. GOV.UK terms permit address display for residential property price information, subject to acknowledgement. The National Archives page itself still returned HTTP 403; publisher terms were successfully read.

## Transaction identifiers and coordinates (implemented)

July and August 2026 official monthly files provide 246 exact identifier joins (245 UPRNs) to the 6,325 residential sales; 6,079 remain unmatched. Zero conflicting joins were found. The September 2026 OS Open UPRN release (snapshot 14 August 2026) locates all matched transactions, with 177 inside the map and 69 outside. Both source releases, hashes and all per-pair evidence remain in the versioned asset. This is partial monthly lookup coverage, not a complete historical archive. See [uprn-matching.md](uprn-matching.md).

## ONS neighbourhood statistics (implemented)

`npm run data:neighbourhoods` (or `-- --offline` to reuse the cache) builds `public/data/neighbourhoods.v1.json`:

- **Boundaries:** ONS Lower layer Super Output Areas (December 2021) Boundaries EW BGC (V5), ArcGIS item `68515293204e43ca8ab56fa13ae8a547` (modified 11 August 2025). The query selects LSOAs whose boundary intersects `BOUNDS`; boundaries are not clipped. Generalised to 20 m; coordinates are rounded to 5 decimal places (~1 m).
- **Statistics:** Census 2021 TS001 (Nomis `NM_2021_1`, all usual residents) and TS006 (Nomis `NM_2026_1`, usual residents per km²), requested for exactly those LSOA codes. Density is the published value, not recomputed from generalised boundaries.
- **Checks:** every boundary needs both values with matching names and status `A`; blank values fail rather than becoming zero; extra codes, duplicates and truncated queries fail. The ignored `raw/neighbourhood/audit.json` compares density computed from generalised boundaries with the published value as a join check (current run: 0.98–1.05, no outliers).
- **Result:** 217 LSOAs (100 Reading, 86 Wokingham, 27 West Berkshire, 4 South Oxfordshire), 369,760 usual residents, 9,869 coordinates. Repeated offline builds are byte-identical (SHA-256 `21c4e168…0f40`).
- **Licence:** Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2025.

ArcGIS/Nomis responses are API outputs, not fixed files, so later downloads may differ. The importer warns when a source hash differs from the published asset; review the change before replacing it. All values describe 2021 areas on Census Day. They are not current, not a property attribute and not about any resident.

## Schools (implemented)

`npm run data:schools -- --date 20261018` (add `--offline` to reuse the cache) builds `public/data/schools.v1.json` from the GIAS "all establishment data" CSV, `https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata<date>.csv` (65 MB, Windows-1252; plain GET, redirects refused). The cache receipt records URL, SHA-256 and retrieval date.

- **Selection:** status Open or Open, but proposed to close, with a published easting/northing whose converted position is inside the map box. Of 52,594 rows: 151 kept, 105 closed establishments inside the box ignored, 1,918 rows without coordinates omitted (never placed by postcode or guesswork).
- **Coordinates:** published British National Grid values converted with the Ordnance Survey 7-parameter Helmert shift (verified against the OS worked example), about 5 m. This is adequate for markers, not for boundaries.
- **Fields:** URN, name, official type and phase labels (kept verbatim), statutory age range when published, local authority, postcode, an http(s)-only website and a link to the official GIAS record. Pupil numbers, head teachers and telephone numbers are deliberately not copied.
- **Not included:** Ofsted or other inspection information (a separate dated source), catchments, admission arrangements or any ranking. GIAS carries 2011 LSOA codes, so the field is not used; positions were cross-checked instead against the 2021 LSOA coverage (all inside) and well-known schools.
- **Result checksum:** repeated offline builds are byte-identical (SHA-256 `dca5ba8d…843c`).
- **Licence:** Contains public sector information from Get Information about Schools, Department for Education, licensed under the Open Government Licence v3.0.

The extract is a snapshot; closures, openings and mergers after 18 October 2026 are not reflected until a new dated extract is reviewed and published.
