# Fracture Sim

A browser-based 2D rigid-body sandbox. Rapier2D runs at a fixed 60 Hz in a Web
Worker; WebGPU renders the convex polygons. This replaces the previous
soft-body FEM simulator. Grab bodies directly, throw balls, or apply a local blast. Glass fractures on
impact, including collisions between fragments.

## Requirements

WebGPU is required for rendering. A browser without a usable WebGPU device
shows a notice and starts no simulation. GPU loss or a physics-worker failure
stops the simulation with an explanation; reload to restart.

## Using it

Choose `plate` to place a single glass plate at rest on the floor, `pile` for
1,000 small bodies, or `stress` for 2,000. Pause freezes physics; Reset rebuilds
the selected scene. The default glass plate starts intact; lift and release it or throw a ball to fracture it. Bodies collide with each other and the container and sleep
when they settle. `Grab` lifts a body and releases it with the pointer velocity;
`Throw ball` launches from the start of a drag toward its end; `Blast` pushes
bodies within 2 m of a click. Under `Material`, select a `Fracture preset`: Glass, Ice (−13°C), Acrylic (PMMA), Polystyrene or Custom. `Fracture energy (J/m²)` and `Thickness (mm)` determine the displayed `Crack energy` in J/m. Editing fracture energy switches to Custom. Changes apply to future impacts without rebuilding the scene; Reset retains the selected material and thickness. Under `World`, adjust gravity (0–40 m/s²), world scale (×0.01–×3, starting at ×0.2, with ×1 = 10 × 5.2 m), areal density (1–100 kg/m²), and friction (0–2). These slider ranges are empirical. World scale multiplies width and height together, retaining their ratio. A scale bar in the bottom-right corner occupies one tenth of the canvas width and shows the corresponding physical length directly in metres (0.01 m at ×0.01, 1 m at ×1). Its width stays fixed while adjusting World scale; its end ticks point upward. It resizes with the viewport. Gravity and friction apply live; scale and density changes restart the selected scene, even while paused. The header Reset restarts the scene and retains all settings; `Reset parameters` at the top of the popup restores every setting except scene and tool, and the icon beside each value restores just that setting. Smaller worlds shrink the pile/stress scene bodies uniformly to fit; under `Object`, choose Rectangle, Ellipse, Triangle or Hexagon and adjust its bounding-box width and height (default 0.5 × 0.5 m, minimum 0.1 m, or a tenth of the world width in a world narrower than 1 m). Selecting a shape keeps the current width where possible and sets its height to make a circle, equilateral triangle, regular hexagon or 2:1 rectangle. The shape scales uniformly to fit world bounds and minimum dimensions. Width and height remain independently editable afterward. Ellipses use 32-sided polygons for both collision and rendering; mass uses that polygon’s actual area. Other shapes also use their actual area and centroid. Thin polygons retain their vertices through a triangle-compound collider when Rapier would simplify the hull; mass and inertia are set from the original polygon. These controls apply to the single-object `plate` scene and restart it at rest on the floor. The slider maxima leave 0.1 m of clearance within the world (a tenth of the world width when that is smaller); reducing the world scales the object uniformly to fit, except that manually stretched objects cannot shrink either dimension below that minimum. Object size is retained by Reset and scene changes. With device motion enabled, measured gravity is multiplied by the selected g / 9.8 without normalization; shake acceleration remains independent. Pausing disables pointer tools; the Pause button sits in the header beside Reset. On devices
with motion sensors, `Device tilt` reads 3-axis accelerometer data, transforms it into the screen frame, and applies its XY components without normalization or a 90° clamp. Upside-down readings produce upward gravity; flat readings have little in-plane gravity. Shaking pushes bodies independently.

## Development

Built from [`nemolize/web-app-template`](https://github.com/nemolize/web-app-template):
React, Vite, Tailwind, Vitest, Playwright and Cloudflare Workers static hosting.

```bash
mise install
pnpm install
pnpm run dev
```

| Command                           | What it does                                 |
| --------------------------------- | -------------------------------------------- |
| `pnpm run lint`                   | ESLint, type checks, Prettier, knip, zizmor  |
| `pnpm run test`                   | Physics and component tests                  |
| `pnpm run test:coverage`          | Tests with 100% coverage for pure TypeScript |
| `pnpm run test:e2e`               | Playwright against the dev server            |
| `E2E_PREVIEW=1 pnpm run test:e2e` | Playwright against the production build      |

Chromium tests use SwiftShader WebGPU by default; `E2E_WEBGPU=hardware` selects
the machine's GPU. The browser tests drive the actual physics worker, verify
resting height and 1,000-body containment and sleep, and check rendering and
failure notices. The old FEM stability sweep is replaced by these tests.

### Layout

- `src/rigid/gesture.ts`, `tools.ts`, and `interactions.ts` — pointer gestures, tool messages, and Rapier joints/impulses.
- `src/rigid/world.ts` — Rapier world, convex shapes, fixed stepping and snapshots.
- `src/rigid/worker.ts` and `types.ts` — worker entry point and message contract.
- `src/rigid/renderer.ts` — WebGPU polygon rendering from worker transforms.
- `src/gpu` — device acquisition and canvas sizing.
- `src/sim/motion.ts` — device motion processing, independent of physics.
- `src/harness` and `harness.html` — browser-worker test harness.
- `src/App.tsx`, `src/ControlPanel.tsx`, `src/FractureCanvas.tsx` — UI and worker lifecycle.

Rapier2D is Apache-2.0 licensed; the compat distribution embeds its WASM so the
browser worker loads without a separate WASM URL or server-side instantiation.

## Fracture geometry

`src/sim/split.ts` exports `splitConvex(parent, seeds)`, a pure Voronoi split
for convex polygons. Seeds use the parent vertex frame. Each result contains
a true `domain` and a collision `polygon` with at most eight vertices, both
relative to the piece centroid, plus its offset from the parent centroid,
area and centroidal polar area moment at density 1. Repeated splits must use
`domain` so collision simplification cannot discard mass or momentum.
Invalid polygons, non-interior or duplicate seeds, degenerate cells, and
nonrepresentable area or polar moments throw.
`src/sim/fracture.ts` divides impact energy by the energy per metre of new crack.
The material controls convert measured fracture energy with `Gc × thicknessMm / 1000`.
Glass is the initial preset: 7 J/m² at 10 mm gives 0.07 J/m. Ice uses 1.5 J/m²,
PMMA 500 J/m², and polystyrene 400 J/m². Sources and conditions are in
[Material presets](docs/material-presets.md). Positive finite crack energies below
1 J/m are supported. Changing the effective crack energy cancels queued splits.
A hit must exceed the body's narrowest width before splitting. Seeds are tried
nearest the contact first, with spacing increasing with distance. Actual shared
Voronoi edge length must fit the energy budget; pieces smaller than 0.005 m²
are rejected. A hit creates at most 40 pieces.

`src/rigid/fracture.ts` uses contact impulses to locate active contacts, but budgets
fracture from the lost normal-mode kinetic energy across the step, including
angular effective mass. Static support impulses do not become impact energy.
The per-contact budget is shared between bodies, rather than assigned twice.
See [Impact energy](docs/impact-energy.md) for equations and model limits.
It replaces the parent with children carrying
its post-impact rigid velocity field. True domains and explicit mass/inertia
survive repeated splits. Mass is tracked in float64 with the final child taking
the remainder; Rapier's physical mass/poses use float32. The live-body cap is
2,000 including thrown balls, excluding container walls and grab anchors. A split
that cannot fit leaves its parent intact and queues the same split until room
appears. A throw at capacity is refused. Reset rebuilds the scene and clears the
queue. No bodies are evicted to make room. Geometry and poses travel together
when a split changes the render buffers.

Run the local 32-seed benchmark without coverage:

```bash
pnpm exec vitest run split.bench.test.ts --disableConsoleIntercept
```

It warms up 100 splits, then reports mean and p95 for 1,000 different inputs.
The performance test is skipped when `CI` is set.

## Deployment

`.github/workflows/deploy.yml` deploys `main` to a Cloudflare Worker named
`fracture-sim`. Set up `production` and `preview` environments with a
`CLOUDFLARE_API_TOKEN` each, following the template's README.

## License

MIT
