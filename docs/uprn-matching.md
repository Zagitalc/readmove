# Official transaction identifiers — stage 5

The August 2026 HM Land Registry transaction-to-UPRN lookup was downloaded from the link on the [official source page](https://www.gov.uk/government/statistical-data-sets/transaction-unique-identifier-and-uprn-look-up-table-dataset) on 3 October 2026. It is free, under OGL v3.0 with both Land Registry and OS attribution. Existing Price Paid address conditions still apply.

- URL: `https://price-paid-data.publicdata.landregistry.gov.uk/pp-uprn-lookup-aug-2026.csv`
- Bytes: 4,624,174; file Last-Modified: `Mon, 28 Sep 2026 05:12:50 GMT`.
- SHA-256: `4a21a086c786ad5f9bb66c6d16abb9b84514146abcd52e1f983fec72fc38524f`.
- National input: 84,149 rows, two columns, no header; transaction UUID and UPRN.
- Exact matches to the bundled 6,325 residential transactions: **100 (about 1.6%)**.
- 6,225 transactions have no match in this monthly lookup. Zero conflicting matches; zero duplicate matched rows. The 100 transactions have 100 distinct UPRNs.
- **Zero verified coordinates and zero building joins.** Absence from a monthly lookup does not mean a property has no UPRN.

The 2026 monthly file contains some identifiers for 2025 sales. This measured overlap does not establish complete historical coverage. The transaction UUID is the join key; no address similarity, postcode centroid or nearest-building inference is used.

## App behaviour

Open Sold prices, choose Both categories, then check **Only with an official UPRN**. The result count is 100. Expand a transaction reference to see its official UPRN and “coordinates pending”. Normal sold-address search still covers all 6,325 residential records. No new map pins are displayed in this release.

The lookup asset is fetched with the sold-price panel and bound to the exact price asset's SHA-256. A stale or mismatched lookup is rejected while price search remains available; reopening retries. A UPRN is not treated as an OSM footprint or evidence of a coordinate. Shared contracts keep coordinate-source evidence separate; it is absent from the current bundle.

## Reproduce the identifier join

The original CSV is retained in ignored `raw/uprn-aug-2026/source.csv`. The publisher URL can change; keep the verified raw bytes and receipt.

```sh
npm run data:sales:uprn -- \
  raw/uprn-aug-2026/source.csv \
  public/data/sales-2025.v1.json \
  raw/rebuilt-sale-identifiers.json
```

Output must not exist. The parser validates every row, keeps only relevant transaction IDs, deduplicates identical rows, excludes conflicting UPRNs and reports ambiguous/unmatched counts. The preparation script pins the reviewed source hash and writes a separate versioned asset; it neither deploys nor edits the original price dataset. The bundle records retrieval at day precision; no exact retrieval time is asserted.

## Remaining coordinate blocker

The official OS product page at `https://www.ordnancesurvey.co.uk/products/os-open-uprn` and download metadata at `https://api.os.uk/downloads/v1/products/OpenUPRN/downloads` return proxy HTTP 403 in this running cloud environment. The two exact hostnames were added to the saved network draft, preserving existing hosts and package-manager presets. Saving the draft has not enabled runtime access.

Apply the saved network update in environment settings, then retry the official product and download metadata. Verify the actual current release, download URL, format, CRS and terms before writing its importer. OS Open UPRN is the intended free coordinate source; no coordinate archive has been fetched or its live schema validated yet. No payment, key or alternative provider is being requested at this point.

Once accessible: join official UPRN coordinates, validate latitude/longitude and duplicate/conflicting points, separate out-of-map records, audit representative flats/houses, then add optional sale markers and distance-based comparisons. Keep building identity separate, retain coordinate-source dates/attribution, and leave the 6,225 unmatched transactions searchable.
