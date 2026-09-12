# 3D Fractal Playground

An accessible WebGL2 playground for exploring 3-D fractals. Turn knobs, watch the shape change. Built so a curious kid (or anyone) can wander through forms without needing the math first.

Techniques draw on public distance-estimator (DE) and signed-distance literature — including write-ups by Inigo Quilez at [iquilezles.org](https://iquilezles.org) — plus classic Mandelbulb / Mandelbox / IFS formulas. This project is original GLSL and UI. It is not affiliated with those authors.

## How to run

Needs Node.js 18 or 20, and a browser with WebGL2.

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173/`).

Other scripts:

```bash
npm run build      # production bundle in dist/
npm run preview    # serve the built bundle
npm run check      # catalog + equation sanity checks
```

`vite.config.js` sets `base: "./"` so the build also works from a relative folder.

## Layout tour

- **Left:** live 3-D viewer. Drag to orbit, scroll to zoom. HUD shows the name, frames per second, and quality percent.
- **Right:** library picker and knobs. Only the knobs that matter for the current family are shown, plus shared look knobs.
- **Bottom:** custom equation box, example chips, and a dialect cheat-sheet.

Every control has a small **i** at its corner. Hover, focus, or click it for a plain-language tip.

On a narrow screen the viewer stacks on top, then knobs, then the equation bar.

## Knobs

**Shape** (shown when the family uses them)

| Knob | What it does |
| --- | --- |
| Power | How many times the shape folds. Low = puffy, high = spiky. |
| Iterations | How many times the recipe repeats. More = finer cracks, slower. |
| Bailout | How far a point may wander before we stop. |
| Scale | Stretch or shrink the math (room size on boxes/stars). |
| Offset X/Y/Z | Slide the recipe. Uneven slides make lopsided shapes. |
| Rotate | Twist the sculpture. |
| Julia X/Y/Z | A seed that stays put while the shape grows. |
| Fold / Min radius | Mirror width and sphere-fold size on box / IFS families. |

**Look** (always available)

| Knob | What it does |
| --- | --- |
| Color palette | Cosmic, Sunset, Ocean, Forest, Candy, Fire, Ice, Gold, Neon, Ink. |
| Glow | Light that leaks from cracks and silhouettes. |
| Soft shadow | Soft shadows under folds. |
| AO | Darkens tight corners so holes look deep. |
| Exposure | Overall brightness. |
| Max steps | How many ray steps. More detail, more cost. |
| Cam distance | Camera distance (scroll on the picture also zooms). |

The picture adapts: if frames drop, resolution and step count ease down, then climb back.

## Library

There are **121** named presets across real DE families, not copies of one look:

- **Bulbs** — Mandelbulb powers 2–16, soft/deep/tilted/shifted variants
- **Julia** — Julia bulbs with different seeds (coral, needles, ribbons, …)
- **Boxes** — Mandelbox scale/fold/radius cities
- **Sponges** — Menger cubes at several depths
- **Stars** — Sierpinski tetra, octahedral IFS, kaleidoscopic IFS, tetrabrot
- **Hybrids** — box+bulb folds, 3-D burning ship / abs-bulb
- **Worlds** — quaternion Julia, Apollonian foam, pseudo-Kleinian

Search the list, filter by category, or use **Prev / Next** (also ← → when you are not typing). **Surprise** picks a random preset. **Reset** restores the current library defaults.

## Custom equation dialect

Nothing you type is run as page JavaScript. The text is tokenized, parsed, and compiled to a small GLSL snippet. Only a whitelist of words is allowed.

**Variables:** `x y z` · `w` or `r` = distance from the center · `pi` `e` · `scale` `power` `bailout` · `ox oy oz` (offset) · `cx cy cz` (julia seed)

**Functions:** `sin cos tan abs floor fract sign sqrt exp log acos asin atan length min max pow mod clamp mix step smoothstep`

**Operators:** `+ - * / ( )` and commas

Two recipe shapes:

1. **One expression** — a distance. The surface is where it equals 0. Example: `w - 1.0` is a sphere.
2. **Three expressions** — new `x, y, z` each iteration (escape-time). Example: `sin(x)*1.4, sin(y)*1.4, sin(z)*1.4`

Example chips under the box apply those recipes. If parsing fails, a friendly error explains what to fix (`^` is rejected in favor of `pow(a, b)`).

## Save / load

- **Download JSON** writes the selected preset id, every knob, the custom equation, and the camera.
- **Load JSON** restores a file from this playground.
- The last session also autosaves in `localStorage` (key `fractal-playground-autosave`) and reloads on the next visit.

## MVP vs later polish

**In this MVP**

- Fullscreen-triangle WebGL2 raymarching (no Three.js)
- 13 DE families + 121 curated presets
- Kid-friendly knobs and i-tips
- Safe custom equations
- JSON download / upload + autosave
- Filmic tonemap, fog, cheap soft shadow and AO, orbit-trap palettes
- Adaptive quality HUD

**Later polish (not required here)**

- Stereo / VR, recorded fly-throughs, more IFS symmetry groups
- A visual node editor for hybrids
- Finer derivative tracking on custom iterate recipes
- Touch-specific two-finger zoom
- Offline PWA packaging

## Known limits

- Heavy presets (deep Menger, high iteration hybrids) need a mid-range GPU. Quality will drop before the tab freezes.
- Custom iterate recipes use a simple derivative stand-in, so the camera can sink into thin features.
- WebGL2 is required. There is no WebGL1 fallback.
- The slow spin of the sculpture is built in (a little motion so the default view feels alive).

## Credits

Public DE / SDF ideas from the demoscene and research community, especially articles at iquilezles.org, plus the Mandelbulb, Mandelbox, kaleidoscopic IFS, Apollonian / Kleinian limit sets, and quaternion Julia sets. Citations only — no affiliation.
