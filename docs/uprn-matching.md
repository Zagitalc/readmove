# Verified transaction locations — local 3 October 2026

The initial local checkout (`02ae156`, clean detached HEAD) contained the August identifier-only release: 100 matches and **zero coordinates**. The expected cloud coordinate/UI patch was not present. This implementation adds a separate `sale-locations.v2.json`; the old v1 remains an immutable historical input. The original price asset is unchanged.

## Measured coverage

| Measure | August only | July + August |
| --- | ---: | ---: |
| Residential price records | 6,325 | 6,325 |
| Exact transaction identifiers | 100 | 246 |
| Unmatched identifiers | 6,225 | 6,079 |
| Ambiguous identifiers | 0 | 0 |
| Transactions with OS coordinates | 100 | 246 |
| In the map bounds | 65 | 177 |
| Outside the map bounds | 35 | 69 |

August's coordinates above were measured during this local work, not present at checkout. July supplied 147 matches, including one identical overlap and **146 additions**. There were no duplicate candidate rows within either lookup and no conflicting transaction mappings. The 246 transactions refer to 245 distinct UPRNs; the 177 in-bounds transactions refer to 176 distinct UPRNs across 160 coordinate positions. Identifier coverage is 3.89%; in-map coverage is 2.80% of the postcode-area residential subset. Outside-map coordinates remain explicit, with no markers or distance comparisons. All unmatched sales remain searchable.

These two monthly files are **not a complete historical lookup archive**. Missing matches do not establish absence of a UPRN. The earlier June HTTP 403 does not establish whether that dataset exists; no conclusion is drawn from it.

## Sources and evidence

Retrieved **2026-10-03** from official public endpoints without credentials or payment. HMLR lookup terms and attributions: [publisher page](https://www.gov.uk/government/statistical-data-sets/transaction-unique-identifier-and-uprn-look-up-table-dataset). Existing Price Paid address-display conditions continue to apply.

| Source | Rows | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| [July 2026](https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-jul-2026.csv) | 94,112 | 5,169,801 | `1d05becac589365a0f87b81f06b9a79c83281a600f49267b7f18a36f91ef3254` |
| [August 2026](https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-aug-2026.csv) | 84,149 | 4,624,174 | `4a21a086c786ad5f9bb66c6d16abb9b84514146abcd52e1f983fec72fc38524f` |
| [OS Open UPRN September CSV ZIP](https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect) | 41,676,575 CSV rows | 619,271,161 ZIP bytes | `107503d45bedaab7f74511766eedbd617f9ca3592113363711e94f4b6458d55a` |

Both HMLR responses had Last-Modified `Mon, 28 Sep 2026 05:12:50 GMT`; do not substitute the period for that transport timestamp. OS's response had Last-Modified `Thu, 17 Sep 2026 15:18:09 GMT`. Its metadata reported MD5 `1d5c21d8166d6efd74850ec6f1ae77ab`.

The **September release** is `osopenuprn_202609_csv.zip`. Its embedded `versions.txt` says **Data Extraction Date: 14-08-2026**. That snapshot date is distinct from the release period and download date. The member `osopenuprn_202609.csv` is 2,273,707,279 bytes; SHA-256 `aafe9a43365469f8b57954583344947b8f877266b88b1d92823cd67259cecd98`. Its header is `UPRN,X_COORDINATE,Y_COORDINATE,LATITUDE,LONGITUDE`; points use supplied longitude/latitude, never BNG metres interpreted as degrees. The archive's licence requires “Contains Ordnance Survey data © Crown copyright and database right 2026.” [OS product documentation](https://docs.os.uk/os-downloads/products/addresses-and-names-portfolio/os-open-uprn).

Every identifier stores all supporting lookup hashes; each hash resolves to a URL, release period, retrieval day and checksum. Identical pairs deduplicate across releases. Conflicting pairs retain all candidate UPRNs and evidence in `ambiguous` and receive no coordinate link. Conflicts within a release cannot disappear when releases merge. Coordinate evidence has its own archive/member checksums and dates. Runtime schemas reject missing evidence, invalid/duplicate coordinates, unknown UPRNs, ambiguous coordinate use and inconsistent coverage.

Transactions, identifier mappings and coordinates remain separate. No postcode centroid, fuzzy address or arbitrary building assignment is used. An OS point is an official observation, not a verified footprint or property boundary.

## Reproduce locally

Python 3.11+ and Node 24+ are sufficient; no extra Python packages. Inspect [OS metadata](https://api.os.uk/downloads/v1/products/OpenUPRN/downloads) before downloading: the endpoint redirects to the current release, which may change. Retain original bytes in ignored `raw/`. Never commit the national ZIP/CSV or signed redirect URLs.

```sh
mkdir -p raw/uprn-jul-2026 raw/uprn-aug-2026 raw/os-sep-2026
curl -fL 'https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-jul-2026.csv' -o raw/uprn-jul-2026/source.csv
curl -fL 'https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-aug-2026.csv' -o raw/uprn-aug-2026/source.csv
curl -fL 'https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect' -o raw/os-sep-2026/source.zip
node --import tsx scripts/property/prepare-verified.ts public/data/sales-2025.v1.json raw/uprn-jul-2026/source.csv raw/uprn-aug-2026/source.csv - raw/combined-identifiers.json
python3 scripts/property/os_coordinates.py raw/os-sep-2026/source.zip raw/combined-identifiers.json raw/os-sep-2026/join.json
node --import tsx scripts/property/prepare-verified.ts public/data/sales-2025.v1.json raw/uprn-jul-2026/source.csv raw/uprn-aug-2026/source.csv raw/os-sep-2026/join.json raw/rebuilt-sale-locations.v2.json
cmp raw/rebuilt-sale-locations.v2.json public/data/sale-locations.v2.json
```

Use fresh output paths; preparation refuses existing outputs. Downloads above are for a fresh raw directory—retain existing source files before refreshing. Source hashes are pinned to the reviewed releases; changed bytes require a new audit and deliberate pin/provenance update. OS extraction streams the ZIP member, hashes and validates every row, and keeps only requested UPRNs in memory. It reads to EOF to detect later conflicts; it does not extract the 2.27 GB CSV. Equal coordinates deduplicate; conflicting points are excluded as ambiguous. Invalid values abort before output. This is a reviewed release preparation tool, not an automated monthly refresh service.

## App flow

Sold prices → search **RG1 4PF** → Show mapped sale. Selection clears the query in state and input; three nearby flats (or five sales with all types) match category A within 1 km. Explicit type/category/radius/date filters persist through selection and Back. Same-UPRN sales are excluded from comparisons. Date and distance are inclusive, and future transactions are excluded.

**Fit nearby sales** includes the selected property plus every filtered comparable, including results beyond the first page. Fit measures the current desktop panel or mobile sheet, top navigation, right controls and footer/dock. It uses an overhead view and caps single-point zoom. With no comparables it fits the selection. Filters do not move the camera. While fitting, the camera can show space outside the data boundary because the normal whole-canvas max bounds would otherwise prevent fitting above a mobile sheet; closing the panel restores normal camera limits. Data/marker bounds remain unchanged.

The panel header/close button never scrolls. Results, filters and provenance scroll internally. Map buttons and list buttons support keyboard selection; Back focuses search, Close/Escape restore Sold prices navigation. Loading can be closed; a delayed result cannot reopen the panel or repopulate markers. Failure preserves price search and retries on reopen.

## Integration with stage-6

Reconciled the existing stage-6 coordinate implementation with the expanded lookup and browser-flow work. The original 100-coordinate audit and extractor, coordinate validation and map attribution are retained. The app uses one current renderer/schema path, with optional map points (off by default), an in-map-only filter, grouped co-located sales, exact date filtering, query clearing and explicit fit. The original relative transaction-age selector is superseded by the explicit “Sold on or after” date filter. Earlier verification above describes the pre-merge work; merge-specific checks are recorded in the handoff.
