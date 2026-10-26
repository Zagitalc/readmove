# Measured performance and accessibility

Measured on 18 October 2026 against the deployed site
(`https://readmove.reading-maps.workers.dev/`, Cloudflare Workers Static Assets, Brotli)
from an Apple-silicon Mac, three fresh sessions per profile, medians reported.
Reproduce with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=… npm run measure -- <url> 3`
(`PROFILES=WebKit` runs one profile). Cache disabled; Chromium used software WebGL
(SwiftShader), which makes paint-related numbers pessimistic. These are emulated
phones: real-device numbers are still needed.

## Load, by profile

| Profile                                 | First contentful paint | Map ready | Flood layer downloaded | Neighbourhood layer | Schools layer |
| --------------------------------------- | ---------------------- | --------- | ---------------------- | ------------------- | ------------- |
| Desktop, unthrottled                    | 0.3 s                  | 1.7 s     | 0.17 s                 | 0.05 s              | 0.40 s        |
| Phone, fast 4G (9 Mbit/s, 4× CPU)       | 0.9 s                  | 3.0 s     | 1.3 s                  | 0.14 s              | 0.10 s        |
| Phone, slow 4G (1.6 Mbit/s, 4× CPU)     | 2.9 s                  | 10.0 s    | 4.8 s                  | 0.43 s              | 0.21 s        |
| WebKit, iPhone 15 profile (unthrottled) | 0.3 s                  | 0.9 s     | 0.16 s                 | 0.06 s              | 0.07 s        |

"Map ready" is the first moment the map reports it has started. Main-thread
blocking after enabling flood zones (time in long tasks beyond 50 ms): 1.2 s
desktop, 0.6 s fast-4G phone, 0.4 s slow-4G phone. The throttled values are
lower than the desktop one because long-task timing under CPU throttling is
unreliable; treat them as a floor. WebKit does not report long tasks, so it has
no blocking figure.

Transferred at map ready (Brotli): 537 KB, dominated by the 1.66 MB (432 KB
gzipped) main script that contains MapLibre, Three.js and the app. On-demand
assets: flood zones 718 KB, neighbourhoods 51 KB, schools 8 KB.

## What the numbers say

- The first visit is fine on a good connection and slow on a poor one: 10 s to a
  usable map on slow 4G is almost entirely the 537 KB of script and tiles.
- Flood zones are the one heavy optional download (4.8 s on slow 4G), but they
  only load when requested. In-browser JSON validation costs about 60 ms on this
  Mac (JSON parse 17 ms); the rest of the blocking is MapLibre tessellating about
  150,000 vertices.
- Options if the flood layer needs to feel faster, in order of effort: coarser
  geometry at wide zoom (tolerance 8 m halves the file to 1.5 MB / 350 KB
  Brotli), splitting by tile or area, then self-hosted vector tiles. None is
  implemented; real-phone numbers should decide.

## Browser engines

| Engine                                             | Result                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Chromium (installed Chrome), desktop and Pixel 7   | all 46 browser tests pass                                                                                         |
| WebKit 26.6, desktop Safari and iPhone 15 profiles | all 46 browser tests pass (`PW_WEBKIT=1`)                                                                         |
| Firefox                                            | **not tested**: Playwright's Firefox build (v155) exits at start-up on macOS 27 ("Could not find profile folder") |

WebKit through Playwright is the Safari rendering engine, not Safari itself:
iOS memory limits, thermal throttling and real touch behaviour are not covered.
Run the site on a real iPhone and Firefox before treating either as verified.

WebKit found one real problem: the transient status toast sat over the map on a
short phone viewport and swallowed taps. It is now `pointer-events: none`.

## Accessibility

`tests/browser/a11y.spec.ts` runs axe-core (WCAG 2.0/2.1 A and AA rules) over the
home view, layers panel, Neighbourhood, Flood, Schools and Sold prices panels,
the sources dialog and a building panel with every context section open, at
desktop and phone sizes, in Chromium and WebKit.

The first run failed one rule everywhere: text contrast. The muted greens used
for small captions, legends and provenance were 3.8–4.4:1 against the paper
background, below the 4.5:1 minimum. All affected greys were darkened (≥ 4.7:1)
and the scan is now clean. The same run also showed the "Take a look around"
dock was not a landmark; it now has `role="region"`.

Informational rules outside the gating set (WCAG 2.2 target size, best
practice) found only the skip link not inside a landmark, which is the standard
pattern, and the home-view button being close to its neighbour at the smallest
phone height.

**Not covered by automation:** the map canvas itself, screen-reader behaviour
(VoiceOver, TalkBack, NVDA), real touch target use, reduced-motion appearance
and colour-vision checks of the density and flood colours. Flood zones and
density classes are labelled in the legend text rather than relying on colour
alone. A manual screen-reader pass is the next step.
