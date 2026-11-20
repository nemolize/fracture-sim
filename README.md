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

Choose `plate` to drop a single glass plate from 2 m above the floor, `pile` for
1,000 small bodies, or `stress` for 2,000. Pause freezes physics; Reset rebuilds
the selected scene. The plate survives landing with the default material. Bodies collide with each other and the container and sleep
when they settle. `Grab` lifts a body and releases it with the pointer velocity;
`Throw ball` launches from the start of a drag toward its end; `Blast` pushes
bodies within 2 m of a click. Under `Material`, use the logarithmic `Fracture toughness (J/m)` slider (1–10,000 J/m) to resist breaking or make glass more brittle. Changes apply to future impacts without rebuilding the scene; Reset restores bodies using the selected toughness. Pausing disables pointer tools. Speed controls simulated seconds per real second. On devices
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
`src/sim/fracture.ts` divides impact energy by the material's fracture toughness (effective 2D energy per metre of new crack).
The default is 10,000 J/m and keeps the 2 m plate drop intact; 12 J/m reproduces the earlier brittle setting. Values must be finite and at least 1 J/m. Changing toughness cancels splits queued under the previous material.
A hit must exceed the body's narrowest width before splitting. Seeds are tried
nearest the contact first, with spacing increasing with distance. Actual shared
Voronoi edge length must fit the energy budget; pieces smaller than 0.005 m²
are rejected. A hit creates at most 40 pieces.

`src/rigid/fracture.ts` reads Rapier contact impulses after each fixed step,
including angular effective mass, and replaces the parent with children carrying
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
