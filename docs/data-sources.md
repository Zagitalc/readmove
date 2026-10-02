# Data sources and integration plan

## Implemented

| Dataset                                                                  | Coverage / version                                          | Use and limits                                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenStreetMap via Geofabrik; redistributed ODbL subset from Mini Reading | `[-1.08, 51.39, -0.84, 51.50]`; source 2026-09-04T20:21:21Z | 97,355 footprint records in 1,237 chunks, building types, some names/addresses, source height classification; roads, railway, water and land context |
| readmove development fixtures                                            | 2026-10-02; CC0                                             | Three fictional property links, four transactions, two fictional areas/population counts. Clearly marked; not official observations                  |

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

## Ingestion foundation (implemented, no real sale data bundled)

`npm run data:sales` validates user-supplied HM Land Registry CSVs, applies A/C/D updates, retains unmatched candidates, and accepts explicit documented coordinate links. Nothing is downloaded, joined to OSM by proximity, or published automatically. See [sold-price ingestion](sold-prices.md). The app still displays only clearly labelled sales fixtures.

## Planned: legitimate public dataset connections

| Source                                                                                                                                                                         | Intended integration                                                                               | Refresh / caution                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HM Land Registry Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads)                                                              | Historic sale transactions, independent transaction IDs, published property-type and tenure fields | Monthly bounded extraction; preserve corrections/deletions and transaction categories. Not a complete inventory of homes or market valuations. Confirm current licence and required acknowledgement before redistribution. |
| [HM Land Registry UPRN lookup information](https://www.gov.uk/government/organisations/land-registry) + [OS Open UPRN](https://www.ordnancesurvey.co.uk/products/os-open-uprn) | Optional verified transaction → UPRN → coordinate joins, with matching provenance                  | Check product availability, coverage and terms. Older/unmatched transactions remain unmatched. OS Open UPRN is a coordinate identifier product, not a free full address directory or property boundary.                    |
| [EPC Open Data](https://epc.opendatacommunities.org/)                                                                                                                          | Certificate rating, floor area, certificate date and usable identifier links                       | Access and licensing review required. Multiple certificates and measurement definitions need reconciliation. Never derive price/m² without a suitable area and transaction.                                                |
| [ONS Census](https://www.ons.gov.uk/census) / [ONS Open Geography](https://geoportal.statistics.gov.uk/)                                                                       | Official OA/LSOA boundaries, population, density, age, tenure, households and car access           | Versioned census/statistical geography. Preserve denominators and boundary edition; population change needs comparable boundaries. All statistics are area-level, not resident or property characteristics.                |
| [DfE Get Information about Schools](https://get-information-schools.service.gov.uk/)                                                                                           | Establishments, URNs, status, phase, age range and locations                                       | Periodic source version; detect closed/merged schools. Straight-line distance is not a route or admission eligibility.                                                                                                     |
| [Ofsted](https://www.gov.uk/government/organisations/ofsted)                                                                                                                   | Published inspection information and report links                                                  | Preserve inspection/publication dates and framework. Do not reduce different inspection frameworks to a fabricated comparable score.                                                                                       |
| [Environment Agency data](https://environment.data.gov.uk/)                                                                                                                    | River/sea flood areas; separately, surface-water datasets where licensed                           | Preserve official classification, source layer and edition. A mapped polygon intersection is not a survey, insurance quote or property-specific risk rating. Check each product's licence and permitted display.           |

UPRNs, verified address matches and official transaction observations are **not connected to the current map UI**. Import/matching contracts now exist, but require actual source files and evidence. There is no hidden scraping pipeline. The fixture example illustrates the contracts only.

## Experimental / future

Procedural hipped roofs, explicit semi-detached/terrace component models and selective Blender GLBs need reliable building types and geometry. Do not infer a count of separate dwellings from a joined terrace footprint. Property boundaries/gardens require reliable source geometry and appropriate licensing. Catchments require authoritative boundaries and academic years. None is presented as implemented.

## Unavailable without an authorised provider

Current estate-agent listings, asking-price changes and listing photography need a licensed or otherwise authorised source. `ListingProvider` is an unimplemented interface, not a scraper. Rightmove and Zoopla are not queried. Address products beyond open UPRN coordinates may also need a licence; do not treat a future plan as permission to redistribute them.

## Privacy and interpretation

No personal occupant records, resident profiles, private household income estimates, crime maps or tracking. No formal valuations. Only aggregate neighbourhood statistics at their documented scale should be integrated. Each new dataset must expose its own provenance and date in the relevant panel, and unavailability must remain distinct from zero observations.
