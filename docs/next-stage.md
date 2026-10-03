# Next stage: verified sale locations

The 2025 official residential price panel is implemented and audited. Keep it useful independently of map matching; there is no paid data requirement for this release.

1. Inspect the free official monthly transaction-to-UPRN lookup, record its scope and join coverage against imported transactions; do not assume it covers older years.
2. Obtain a versioned OS Open UPRN coordinate extract, verify licence/attribution and coordinate system, then audit transaction → UPRN → point joins.
3. Keep points separate from OSM building identity, especially flats and multiple dwellings. Do not assign the nearest footprint silently.
4. Connect reviewed locations to real comparable sales with type/date/category controls. Exclude unlocated records from distance queries and keep them available through address search.
5. Add more annual source files or a complete baseline with explicit corrections/versioning. A 2025 file is not full historical coverage.

See [sold-prices.md](sold-prices.md) for the completed release, evidence, limitations and reproducible commands. Census, schools, EPC and flood layers remain later stages.
