# Fracture Sim

A nonlinear destruction simulator that runs in the browser. A body made of
triangles deforms elastically, yields plastically, accumulates damage and breaks
apart, and you can throw a ball at it, pull it, or blast it.

This is the 2D version; a 3D one is the plan once the 2D model feels right.

## What it models

- **Finite deformation** — Hencky hyperelasticity on a triangle mesh, solved with
  an explicit time step, so large rotations and stretches are handled.
- **Plasticity** — von Mises yield with linear hardening, applied by return
  mapping on the principal stretches. Clay and steel flow instead of cracking.
- **Fracture** — each triangle carries a damage value that grows when its tensile
  stress passes the material strength, softens its tension, and removes the
  triangle at 1. Cracks therefore advance from stress concentrations. Plastic
  strain adds damage too, which gives ductile tearing.
- **Materials** — glass, concrete, steel and clay differ only in the numbers in
  `src/sim/materials.ts`. They are tuned to look right, not measured from real
  materials.

Known limits: cracks are triangle-wide erosion rather than a discrete split of
the mesh, eroded mass is removed instead of kept as debris, and separate pieces
pass through each other.

## Using it

Pick a scene, a material and a view (damage, plastic strain, tensile stress, or
one colour per piece), then choose a tool:

- **Throw ball** — drag on the canvas; the ball flies the way you drag.
- **Pull** — press on the body and drag.
- **Blast** — click to push everything nearby away from that point.

## Development

Built from [`nemolize/web-app-template`](https://github.com/nemolize/web-app-template):
React, Vite, Tailwind, Vitest, Playwright and Cloudflare Workers hosting.

```bash
mise install
pnpm install
pnpm dev
```

| Command                           | What it does                                |
| --------------------------------- | ------------------------------------------- |
| `pnpm run lint`                   | ESLint, type checks, Prettier, knip, zizmor |
| `pnpm run test`                   | Unit tests (solver and components)          |
| `pnpm run test:coverage`          | Unit tests with the 100% coverage threshold |
| `pnpm run test:e2e`               | Playwright against the dev server           |
| `E2E_PREVIEW=1 pnpm run test:e2e` | Playwright against the production build     |

The solver is in `src/sim`; the React layer around it is `src/App.tsx`,
`src/ControlPanel.tsx` and `src/FractureCanvas.tsx`.

## Deployment

Deployment follows the template: `.github/workflows/deploy.yml` deploys `main` to
a Cloudflare Worker named `fracture-sim`. It needs the `production` and `preview`
environments with a `CLOUDFLARE_API_TOKEN` each, as described in the template's
README under "After using this template". Until those exist the Deploy job fails.

## License

MIT
