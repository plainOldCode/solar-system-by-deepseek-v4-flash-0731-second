# Logarithmic Solar System

> **한국어:** 이 문서의 한국어 버전은 [README.ko.md](README.ko.md)에서 볼 수 있습니다.

An interactive 3D Solar System demo built with **Vite + TypeScript (strict) +
Three.js**. It spans the Sun through Pluto plus the major moons, using real
astronomical data compressed behind a logarithmic distance scale and
visibility-enhanced body sizes so the whole system fits on one screen.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. Production build:

```bash
npm run build   # runs `tsc --noEmit` (type-check), then `vite build`, then `npm run verify`
npm run preview
```

Standalone verification (dataset integrity + scale-function invariants):

```bash
npm run verify  # 25 checks: required bodies/moons, source metadata, finite values,
                # boundary conditions, monotonicity & order preservation, no NaN
```

The verification (`src/verifyCore.ts` + `scripts/verify.mjs`) bundles the pure
scale functions and datasets with esbuild and asserts every invariant without
starting a browser. It runs as part of `npm run build`.

The demo needs no external runtime assets — bodies use procedural colors and
procedurally generated star fields.

## Controls

- **Left-drag** — orbit camera
- **Wheel / pinch** — zoom
- **Right-drag** — pan
- **Click a body** — select / focus it (Sun = whole view, planet = its moons,
  moon = framed with its parent); the camera eases in smoothly
- **Double-click empty space or Reset** — return to the full Solar System view
- **← Back** button (appears in the control panel while a body is focused) —
  return from a planetary detail view to the full Solar System view
- **H key** — hide / show the entire UI overlay (panels, info, tooltip, labels)

## UI panel show / hide (H)

Pressing **H** toggles a single overlay switch. It hides everything the HUD
contains — control panel, information panel, tooltip, scene labels and the
disclaimer — in one go. The 3D canvas, animation and OrbitControls interaction
(including object selection) keep running while hidden, and pressing **H** again
restores the UI exactly as it was.

The **fixed `UI 보기/숨김` button** in the bottom-right corner is an
always-accessible toggle that lives outside the hidden overlay, so the UI can
be brought back with a single click even when every panel is hidden. While
hidden, only this button (and the 3D scene) remain visible.

On small screens the layout is responsive: the control panel shrinks and moves
to the top-right, the information panel becomes a scrollable bottom sheet, and
label density is reduced (smaller labels, secondary English line hidden, larger
on-screen spacing between overlapping labels).

## Distance and size scales

The demo treats **real astronomical values** and **rendered display values** as
separate concepts and never mixes them.

### Heliocentric distance

Real Sun→planet distances are stored as semi-major axes in AU. The default
`Log` mapping compresses them so Mercury through Pluto fit in the viewport:

```
normalized = log1p(distanceAU) / log1p(MAX_DISTANCE_AU)
rendered   = MIN_RENDER_DISTANCE + normalized * (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE)
```

Constants: `MAX_DISTANCE_AU ≈ 39.5`, `MIN_RENDER_DISTANCE = 16`,
`MAX_RENDER_DISTANCE = 190` (tunable in `src/config/constants.ts`).

Selectable modes:

- **Log Scale** (default) — compresses the whole system
- **Linear Scale** — real proportional distances (inner planets crowd near the
  Sun by design, for comparison)
- **Focus Scale** — a local log window centred on the selected planet

### Moon orbit scale

Moon orbits never reuse the global distance scale. Each planetary system owns a
local frame under its planet, and moon distances are mapped to a multiple of the
planet's displayed radius (≈2.5–9×):

```
shifted   = max(0, distanceKm - minKm)
shiftedMax= max(1, maxKm - minKm)
norm      = log1p(shifted) / log1p(shiftedMax)
multiple  = 2.5 + norm * (9 - 2.5)
```

### Body size

Real radii are stored in km, but rendered sizes are independently enhanced so
small bodies stay visible. Default `Enhanced` planet mapping:

```
ratio     = radiusKm / EARTH_RADIUS_KM
rendered  = clamp(0.55 + 0.65 * sqrt(ratio), 0.55, 4.0)
```

The Sun is fixed at 8 units. Moons use a similar mapping clamped to keep a
minimum visible size. Modes: **Enhanced** (default), **Relative** (leans toward
the real ratios), **Uniform** (near-constant marker size).

> **Important:** rendered body sizes and rendered orbital distances do **not**
> share one uniform physical scale. Real distance/size order is preserved, but
> the magnitudes are display-compressed. The in-app disclaimer states this.

## Performance

The demo targets smooth playback on typical desktop and mobile browsers:

- **No per-frame object allocation.** Orbit-line geometry and body geometry are
  built once at construction and reused — scale/UI mode changes only rescale or
  mutate existing objects. The animation loop reuses temporary `Vector3`/`Vector2`
  instances instead of creating new ones, and the simulation clock advances from
  real elapsed wall-clock time, not frame count, so motion is frame-rate
  independent.
- **Capped pixel ratio.** `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`
  avoids the cost of unbounded high-DPI rendering on retina-class displays.
- **Labels update only when needed.** Labels fade/cull and hide through opacity +
  `display` toggles, and avoid touching the DOM when their state did not change;
  the information panel re-renders only on selection or a scale-mode change.
- **Mobile density reduction.** Below the mobile breakpoint the procedural star
  field drops from ~2,900 to ~820 points and label density falls (larger screen
  spacing between labels, hidden secondary English line).
- **Disposal.** Every module exposes a `dispose()` that releases geometries,
  materials, textures, `OrbitControls`, the renderers, the `ResizeObserver` and
  all event listeners so the app can be torn down without leaking GPU/DOM
  resources.

## Data sources & accuracy

Bodies are approximated from public NASA/JPL planetary fact-sheet figures
(major semi-major axes, radii, eccentricity, inclination, orbital/rotation
periods). The dataset guarantees:

- correct order of planets by distance and by size
- correct relative order of orbital periods
- correct parent body for every moon, and moons ordered by distance
- Pluto's comparatively high eccentricity and orbital inclination
- a non-empty `source` (NASA/JPL citation) recorded on **every** body for provenance

Data files: `src/data/solarSystemData.ts` (Star + 8 planets + Pluto) and
`src/data/moonData.ts` (major moons). Moon definitions are isolated so moons can
be added/removed without touching the rendering engine — add a moon by appending
one record; the body index and renderer pick it up automatically.

### Moon selection criteria

The included moons are the well-known "major/reference" moons used in typical
Solar System visualizations: Earth's Moon, Mars' two moons, the Galilean moons,
major Saturnian moons, the five classical Uranian moons, Neptune's Triton, and
Pluto's five known moons.

## Project layout

```
src/
  main.ts            entry point (assembly only)
  styles.css         layout & HUD styling
  types.ts           shared domain types / contracts
  config/constants.ts  all tunable constants + copy
  data/              solar system + moon datasets, body index
  core/              scale / simulation / selection / scene / body / orbit / app
  ui/                labels / control panel / info panel / tooltip / dom helpers
```

Modules communicate through a small typed state hub (`core/StateStore.ts`) so
UI controls and the 3D scene react without a central controller, and `main.ts`
stays tiny.

There is also `CHECKLIST.md` at the repository root mapping every §18 completion
criterion plus the UI show/hide requirement to its implementing module.
