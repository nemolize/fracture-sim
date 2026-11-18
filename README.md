# Fracture Sim

A browser-based 2D rigid-body sandbox. Rapier2D runs at a fixed 60 Hz in a Web
Worker; WebGPU renders the convex polygons. This replaces the previous
soft-body FEM simulator. Pointer tools and on-demand glass fracture are tracked
in #20 and #21 and are not part of the rigid-world foundation.

## Requirements

WebGPU is required for rendering. A browser without a usable WebGPU device
shows a notice and starts no simulation. GPU loss or a physics-worker failure
stops the simulation with an explanation; reload to restart.

## Using it

Choose `plate` to drop a single glass plate from 2 m above the floor, `pile` for
1,000 small bodies, or `stress` for 2,000. Pause freezes physics; Reset rebuilds
the selected scene. Bodies collide with each other and the container and sleep
when they settle. Speed controls simulated seconds per real second. On devices
with motion sensors, Gyro tilt changes gravity and shaking pushes bodies.

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

- `src/rigid/world.ts` — Rapier world, convex shapes, fixed stepping and snapshots.
- `src/rigid/worker.ts` and `types.ts` — worker entry point and message contract.
- `src/rigid/renderer.ts` — WebGPU polygon rendering from worker transforms.
- `src/gpu` — device acquisition and canvas sizing.
- `src/sim/motion.ts` — device motion processing, independent of physics.
- `src/harness` and `harness.html` — browser-worker test harness.
- `src/App.tsx`, `src/ControlPanel.tsx`, `src/FractureCanvas.tsx` — UI and worker lifecycle.

Rapier2D is Apache-2.0 licensed; the compat distribution embeds its WASM so the
browser worker loads without a separate WASM URL or server-side instantiation.

## Deployment

`.github/workflows/deploy.yml` deploys `main` to a Cloudflare Worker named
`fracture-sim`. Set up `production` and `preview` environments with a
`CLOUDFLARE_API_TOKEN` each, following the template's README.

## License

MIT
