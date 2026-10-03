# Next stage: wider coverage and matching quality

Stage 6 completes the free-source coordinate join: 100 UPRNs located, 65 inside the map, optional points and nearby mapped-sale comparisons. See [the coordinate audit](sale-coordinates.md).

1. Broaden official transaction/UPRN coverage by reviewing later and historical lookup availability; preserve source periods and correction semantics. Current joined coverage is only 100 of 6,325 transactions.
2. Add further sale years or a complete baseline with versioned regional extracts, source dates and explicit market-coverage limitations.
3. Audit dwelling-to-building associations separately, especially flats; never assign a nearest footprint silently. Current points do not select buildings.
4. Improve useful comparable filtering (tenure, new-build status, fuller transaction history) without implying valuation or floor area that the sources do not supply.
5. Add official neighbourhood context only when its source and geographic grain are ready. Census, schools, EPC and flood layers remain later integrations.

No paid map/coordinate API, account or database was introduced. Source archives are retained locally but not shipped to visitors.
