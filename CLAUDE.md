# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Architecture

The app requires WebGPU for rendering. Rapier2D runs in a browser Web Worker at
60 Hz; `src/rigid/world.ts` owns physics and `types.ts` defines the transferable
geometry and pose messages. The React canvas owns worker lifecycle, resize,
pause, and motion input. GPU and worker failures stop the app with a notice.
`src/sim/motion.ts` handles device sensors independently of the physics engine.
Fragments too small to be bodies are render-only particles from `src/sim/particles.ts`,
sent to the renderer in the snapshot.
The old FEM solver, erosion model, material controls and mesh settings are gone.

Coverage is 100% for pure TypeScript, including the real Rapier world. Browser
and GPU entry points are individually excluded in `vitest.config.ts` with their
corresponding e2e test named. `e2e-tests/rigid.spec.ts` exercises the actual worker
and renderer; `index.spec.ts` verifies device failure and hosting behaviour.

The e2e tests use Chromium with SwiftShader WebGPU (`e2e-tests/webgpu.ts`). Do
not edit `src` during an active Playwright run: Vite reloads the test page.

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
WebGPU, the body stands on the floor, rigid bodies collide and settle without non-finite state; `pnpm run build`, the checks CI
runs and `pnpm run deploy` still succeed. Anything that stops one of those for
every user is `high`.

**`type:investigation` takes no priority.** Its impact is what the
investigation exists to find out, and recording an unmeasured impact as `low`
is indistinguishable from having measured it. Apply priority to the follow-up
issue the answer produces, not to the question.

`area:` — the layer the work starts in. The set here matches this template's
layers; a project that grows different ones updates its labels and the Area
dropdown in each form together.

| Label        | Covers                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| `area:ui`    | Screens, components, styles                                                                |
| `area:sim`   | Rigid-body physics under `src/rigid`; device motion and fragment particles under `src/sim` |
| `area:build` | Build, compile, lint/format config, dependencies                                           |
| `area:ci`    | CI pipelines and git hooks                                                                 |
| `area:test`  | Test suites and coverage config                                                            |
| `area:infra` | Deployment target and runtime environment                                                  |

When a change spans layers, label the one a fix starts in rather than every one
it touches.

There is no docs layer; `type:docs` already says the work is documentation. A
docs issue takes the `area:` of the layer the passage it is about describes
(the README's CI section is `area:ci`). A passage about the project as a whole,
such as setup, overview or agent instructions, takes `area:build`.
