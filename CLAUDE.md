# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Architecture

WebGPU is required: the app has no CPU fallback and no Canvas 2D. The solver and
renderer live in `src/gpu` (WGSL under `src/gpu/shaders`, run by `solver.ts` and
`renderer.ts`) and know nothing about React; the React layer (`App`,
`ControlPanel`, `FractureCanvas`) only owns settings, the unavailable and
device-lost notices, and the pointer tools. `src/sim` holds what both solvers
share (meshes, materials, constants) plus the CPU `World`, which exists only as
the f64 reference for tests and is never imported by the app. Every model, tuning
or size constant the shaders use (physics, contact, material, workgroup sizes)
comes from a TypeScript constant through `src/gpu/constants.ts`; never copy one
into WGSL. Palette colours and structural literals such as a clip-space `2.0`
stay in the shader.

Coverage is 100% for pure TypeScript. Modules that need a WebGPU device
(`solver.ts`, `renderer.ts`, `loop.ts`, `FractureCanvas.tsx`) are excluded one by
one in `vitest.config.ts`, each with a comment naming the e2e test that drives
it; a new GPU-coupled file needs the same entry. The two other exclusions are the
test double `src/gpu/fakes.ts` and the e2e page under `src/harness`. Pure code reads
typed arrays through the helpers in `src/sim/array.ts` (one per array type, so V8
keeps the loads monomorphic). Run the CPU reference outside vitest when timing
it: vitest's transform makes a step about six times slower.

The e2e tests run Chromium with SwiftShader WebGPU flags (`e2e-tests/webgpu.ts`).
Edit nothing under `src` while a Playwright run is in progress against the dev
server: Vite reloads the page and the running test fails with "Execution context
was destroyed".

## Design principle: built for large-project scale

This project started from a template that is small on purpose but meant to hold
up in very large projects. Judge tooling, structure and conventions by whether
they still work at that scale, not at this repo's current size. Avoid choices
that stop scaling, such as per-file registrations edited by hand or hand-kept
lists that drift.

## Issue labels

Every issue carries a `type:` label, and every issue that is not an
investigation also carries `priority:` and `area:`. For a generated repository,
create the labels listed below through GitHub before using the issue forms.
A form applies a label only when it already exists.

### Filing an issue yourself

Use `create_issue` with the labels set directly. Do not open the web form and do
not leave labelling to a later pass.

### Completing a human-filed issue

The forms under `.github/ISSUE_TEMPLATE/` set the `type:` label and nothing
else: the reporter's Area choice, and Priority where the form asks for it, land
in the issue body as text. When you pick such an issue up, read those sections
and apply the matching labels before starting work. Where the form has no
Priority section, set `priority:` from the body's impact with the table below;
an investigation takes none.

A section reading `not sure` is the reporter declining to guess — judge it
yourself from the body. A section reading `_No response_` was left empty.

### Choosing the values

`type:` — what kind of work it is.

| Label                | For                                                 |
| -------------------- | --------------------------------------------------- |
| `type:fix`           | Something behaves differently from what it promises |
| `type:feat`          | A capability the project does not have yet          |
| `type:docs`          | Documentation only                                  |
| `type:chore`         | Tooling, infra, dependencies, maintenance           |
| `type:investigation` | The question is what the behaviour even is          |

`priority:` — how soon the owner wants the issue done. Whoever files an issue
sets an initial priority from its impact; the owner overrides it. Judge impact
by who and what is affected, never by how hard the fix looks: a one-line fix for
data loss is `high`, and a week-long refactor that changes no behaviour is `low`.

| Label             | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `priority:high`   | Do next. Default for anything broken or unsafe now                  |
| `priority:medium` | Do soon. Default for something that works but is wrong or degrading |
| `priority:low`    | When convenient. Default for friction, cosmetics and nice-to-haves  |

**Core functionality here is that the simulation runs.** The page loads and finds
WebGPU, the body stands on the floor, a thrown ball, pull or blast reaches it, and it deforms or
breaks without the solver diverging into NaN; `pnpm run build`, the checks CI
runs and `pnpm run deploy` still succeed. Anything that stops one of those for
every user is `high`.

**`type:investigation` takes no priority.** Its impact is what the
investigation exists to find out, and recording an unmeasured impact as `low`
is indistinguishable from having measured it. Apply priority to the follow-up
issue the answer produces, not to the question.

`area:` — the layer the work starts in. The set here matches this template's
layers; a project that grows different ones updates its labels and the Area
dropdown in each form together.

| Label        | Covers                                            |
| ------------ | ------------------------------------------------- |
| `area:ui`    | Screens, components, styles                       |
| `area:sim`   | The solver, materials and contact under `src/sim` |
| `area:build` | Build, compile, lint/format config, dependencies  |
| `area:ci`    | CI pipelines and git hooks                        |
| `area:test`  | Test suites and coverage config                   |
| `area:infra` | Deployment target and runtime environment         |

When a change spans layers, label the one a fix starts in rather than every one
it touches.

There is no docs layer; `type:docs` already says the work is documentation. A
docs issue takes the `area:` of the layer the passage it is about describes
(the README's CI section is `area:ci`). A passage about the project as a whole,
such as setup, overview or agent instructions, takes `area:build`.
