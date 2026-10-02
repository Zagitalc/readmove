# Stage 2 and the next priorities

## Delivered in stage 2

- `BOUNDS = [-1.08, 51.39, -0.84, 51.50]`, about 200 km² around greater Reading.
- Configured zoom 11–19. Initial centre is Reading station `[-0.9718, 51.4589]`, zoom 15.5 and pitch 58°.
- 97,355 in-bounds detail records, 1,237 building chunks and 551 self-hosted vector tiles. The original 5,477-building startup download is removed.
- Two geometry workers, cancellable obsolete requests, deterministic resident limits, geometry disposal, coarse fallback buildings and explicit recovery after failures.
- On-demand search across 49,490 named/addressed buildings, broader place navigation and a whole-area control. Selected/comparison records survive rendering-cache eviction.
- PPD CSV import foundations: streaming validation, source hashes, A/C/D processing, idempotence, source-order checks and no inferred building joins.
- Documented-coordinate match contracts and clear counts for in-bounds, outside-coverage and unmatched records.
- Source-aware comparable engine and sample UI filters for radius, age and property type. No valuation or inflation adjustment.

## Next: actual historic sales, before more map modes

The selected priority is historic sold-price data. Start with an official source release and a coverage audit, then add documented UPRN/coordinate matching. Make unmatched records visible in the pipeline. Only publish a real sale layer after inspecting match quality; do not attach an address to the nearest building to fill gaps.

Keep the map sparse: show relevant comparable markers when a property is selected, preserve source dates in the panel, and add distance/type/recency/price filters. Include tenure and floor-area filters only when those fields are supported by suitable data. D1 is optional until persistent bounded queries or update history genuinely need it.

After real sales: official OA/LSOA boundaries and Census summaries; DfE/Ofsted schools with dates and no admission claims; official Environment Agency polygons with their classifications. Blender/glTF remains a later selective asset pipeline, not a dependency for this stage.

## Explicit limits

The geography source timestamp remains 4 September 2026; map expansion is not a data refresh. Detailed roofs render only nearby and use illustrative materials. The full map is still flat ground. Tile edges can contain partial geometry, and the 44 source footprint centres outside the configured bounds do not have selectable detail records.

The two fictional neighbourhood rectangles retain their original small demonstration extent. Widening the base map does not fabricate Census coverage. Browser checks use desktop/mobile Chromium; physical phones, Safari, Firefox and production GPU/network performance need separate measurement.
