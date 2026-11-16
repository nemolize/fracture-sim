# Web App Template

A modern web application template built with React, TypeScript, and Vite, deployed to Cloudflare Workers.

## After using this template

1. Rename the project: replace `default-project-name` in `wrangler.json` with your Worker name, and update `name` in `package.json` and the `<title>` in `index.html`. `e2e-tests/index.spec.ts` asserts that title verbatim, so update it there in the same pass — otherwise the first CI run fails on the rename.
2. Set up Cloudflare deployment. Production and previews deploy to two Workers — the one named in `wrangler.json` and `<name>-preview` — each with its own token, so a branch run never holds a credential that can touch production (see [Deployment](#deployment)):
   1. Once dependencies are installed (step 4), create the preview Worker with any token that can create Workers: `pnpm run deploy:preview`. The script keeps `-c wrangler.json`, because after a build wrangler otherwise follows the Vite plugin's redirect to `dist/wrangler.json`, ignores `--env preview` and deploys the production Worker. The step stays safe to re-run once you add custom domains or cron triggers, because `env.preview` in `wrangler.json` sets `routes` and `triggers.crons` to empty — keep those overrides, since wrangler otherwise copies the top-level values into the environment: the re-run would move a custom domain off production onto the preview Worker, and add the cron triggers to the preview Worker, so they would run on both Workers. A Worker-scoped token cannot create a Worker, so if the production Worker does not exist yet, create it the same way with `pnpm run deploy`.
   2. In the Cloudflare dashboard (**Manage Account → Account API Tokens**), create two account-owned tokens with the scope **Specified Workers** and the **Editor** role: one for the production Worker, one for `<name>-preview`.
   3. In the repository's **Settings → Environments**, add each as a `CLOUDFLARE_API_TOKEN` environment secret — the production token on `production`, the preview token on `preview` — and give `production` a deployment branch rule that allows only `main`. Do not keep a repository-level `CLOUDFLARE_API_TOKEN`: an environment that lacks its own secret would fall back to it.
3. Create the labels described in [CLAUDE.md](CLAUDE.md#issue-labels) through GitHub before using the forms. Keep the Area dropdowns in `.github/ISSUE_TEMPLATE/` aligned with your project's labels; GitHub skips form labels that do not already exist.
4. Install the toolchain and dependencies — see [Installation](#installation).
5. Review the git hooks: `lefthook.yml` points at a shared config, and whether that suits your project is a per-project decision — see [Git hooks](#git-hooks).
6. Re-baseline the coverage thresholds: `vitest.config.ts` carries this template's own measured coverage, which will not match your project. Run `pnpm run test:coverage` once and, if it fails, replace the `thresholds` values with your project's measured numbers — the ratchet only raises them, so it cannot lower an inherited threshold for you. See [Testing](#testing).

## Features

- **React** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling, with class sorting via `prettier-plugin-tailwindcss`
- **ESLint** and **Prettier** for linting and formatting, with `eslint-plugin-jsx-a11y-x` for accessibility checks on JSX
- **knip** for detecting unused exports, dependencies, and files
- **Vitest** for unit testing with Testing Library
- **Playwright** for end-to-end testing
- **lefthook** for git hooks (lint and format on commit, dependency and toolchain refresh after merge)
- **Cloudflare Workers** for hosting (static assets, SPA fallback) with PR preview deployments
- **Renovate** for automated dependency updates

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev/) — provisions Node.js, pnpm, and zizmor at the versions pinned in `mise.toml`
- [`cloudflared`](https://github.com/cloudflare/cloudflared) — only for `pnpm dev:tunnel`; it is not provisioned by mise

### Installation

```bash
mise install
pnpm install
```

`mise install` has to come first: `pnpm install` needs the pinned Node.js and pnpm on your `PATH`.

### Git hooks

`pnpm install` installs the hooks through its `prepare` script (`lefthook install`). What they do:

- `pre-commit` — runs ESLint and Prettier over the staged files, applying fixes and re-staging them.
- `post-merge` — runs `pnpm install` when the merge touched `pnpm-lock.yaml`, and `mise install` when it touched `mise.toml`.

`lefthook.yml` only points at [`nemolize/lefthook-configs`](https://github.com/nemolize/lefthook-configs), which holds the steps themselves and is shared across repositories — so editing them there reaches every repository at once. To diverge, drop the `remotes` entry and define the hooks in this file; configs merge in the order `lefthook.yml` → `remotes` → `lefthook-local.yml`, so the remote wins over a same-named job left in place.

### Development

Start the development server:

```bash
pnpm dev
```

Serve the dev server through a temporary public URL (useful for sharing work in progress or testing on a phone). Requires `cloudflared` on your `PATH`:

```bash
pnpm dev:tunnel
```

### Building

Build for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

### Testing

Run unit tests:

```bash
pnpm test
```

Vitest runs `src/` tests in the `dom` project with happy-dom and the React
Testing Library setup. Root-level tests run in the `node` project without DOM
setup. Run either group alone with `pnpm run test --project dom` or
`pnpm run test --project node`.

Run unit tests with coverage:

```bash
pnpm run test:coverage
```

CI runs this variant and fails when coverage drops below the thresholds recorded
in `vitest.config.ts`.

Those thresholds ratchet: `autoUpdate` raises them as coverage improves and
never lowers them, so only a regression fails the build. Two consequences are
worth knowing before the first run:

- A local run **rewrites `vitest.config.ts`** once coverage exceeds the recorded
  numbers. Commit that change — CI works on a throwaway checkout, so the ratchet
  advances only through a committed config.
- The thresholds are not a floor you grow into; they are wherever coverage last
  stood. A project generated from this template therefore inherits this repo's
  numbers and needs the one-time reset described in
  [After using this template](#after-using-this-template).

Before the first local end-to-end run, install the Chromium browser used by this
project (after `pnpm install`):

```bash
pnpm exec playwright install chromium
```

On Linux, use `pnpm exec playwright install --with-deps chromium` to also install
the required system libraries; that step may request administrator privileges.
See Playwright's [browser installation guide](https://playwright.dev/docs/browsers).
The CI container already includes the browsers and system libraries.

Run end-to-end tests:

```bash
pnpm run test:e2e
```

By default this runs against the Vite dev server. In CI it runs against the
production build served by the Workers runtime (`pnpm run build && pnpm run
preview`), which is what verifies static-asset serving and SPA fallback. Run
the same target locally with:

```bash
E2E_PREVIEW=1 pnpm test:e2e
```

Both servers bind to port `5173`. When that port is taken, `PLAYWRIGHT_PORT`
moves the dev server, the preview server, `pnpm tunnel` and the Playwright
target together, so an isolated run needs no temporary config:

```bash
PLAYWRIGHT_PORT=5187 pnpm test:e2e
```

Two consequences of the shared port:

- `pnpm dev` and `pnpm preview` cannot run at the same time, and neither can
  run while `pnpm test:e2e` does. Give one of them its own `PLAYWRIGHT_PORT`.
- E2E runs never reuse a server already listening — with one port, a running
  server could be either runtime, and reusing the wrong one would test stale
  `dist/` or bypass the Workers runtime without any signal.

### Code Quality

Check code style and issues:

```bash
pnpm lint
```

Fix automatically fixable code style issues:

```bash
pnpm fix
```

Run type checking:

```bash
pnpm lint:typecheck
```

Accessibility rules come from `eslint-plugin-jsx-a11y-x`, a maintained fork of `eslint-plugin-jsx-a11y`. The original declares no ESLint 10 peer support: its last release is 6.10.2 (October 2024), and two ESLint 10 pull requests have sat unreviewed since February 2026 ([jsx-eslint/eslint-plugin-jsx-a11y#1075](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075)). The fork carries the same rule set, so switching back is a rename if upstream catches up.

### CI pins and workflow security

GitHub Actions are referenced by tag, and `.github/workflows/actions.lock`
pins each one, transitive dependencies included, to a commit. Generate it with
the `gh actions-lock` extension, at the version CI installs
(`gh extension install github/gh-actions-lock --pin v0.4.0`), and rerun
`gh actions-lock` after adding a workflow or changing a `uses:`. CI runs
`gh actions-lock --verify`, so a stale lockfile fails the Checks job.
Renovate keeps `pinDigests` off for GitHub Actions here, since the lockfile
already pins them.

CI audits the workflows with [zizmor](https://docs.zizmor.sh/). `pnpm run lint`
runs its offline audits, with the zizmor version pinned in `mise.toml`. The
online audits, such as `ref-confusion` (a tag reference like `@v1` that could
also name a branch), need a token and are left to CI; to run the full CI audit
locally:

```bash
GH_TOKEN="$(gh auth token)" zizmor .
```

A finding that is intended stays in place with an inline
`# zizmor: ignore[<audit>]` comment giving the reason.

The Playwright container uses a version tag and a registry digest. Renovate's
shared preset updates digests and groups Playwright package and image updates;
the E2E job also checks that their versions match. When changing the image
manually, update both its tag and digest.

## Deployment

Deployment is handled by `.github/workflows/deploy.yml`:

- Push to `main` deploys to production (`wrangler deploy`) through the `production` environment.
- A manual run from `main` redeploys production; a manual run from any other ref uploads a preview version instead.
- Pull requests upload a version to the separate `<name>-preview` Worker (`wrangler versions upload --env preview`) through the `preview` environment; the preview URL is posted as a sticky PR comment. Pull requests from forks are skipped, since GitHub does not expose the secret to them.

Previews live on their own Worker because any token that can upload a version to a Worker can also deploy that version, so a preview token on the production Worker could overwrite production. Each environment's token is scoped to its own Worker, and the `production` environment's branch rule keeps every ref but `main` from reaching the production token.

The workflow runs as two jobs: `Build` produces `dist/` without the Cloudflare token in scope and uploads it as an artifact, and `Deploy` restores that artifact and is the only job the token reaches. That split keeps install and build code off the token-bearing runner — a compromised dependency that rewrites `node_modules/.bin` or the generated config would otherwise be executed by the deploying step.

`Deploy` also runs behind a [bullfrog](https://github.com/bullfrogsec/bullfrog) egress allowlist with `sudo` disabled, so a compromised step cannot send the token to a host the deploy has no reason to reach. A step that needs a new host fails or stalls until the host is added to the bullfrog step's `allowed-domains`; the job summary lists every blocked connection. The artifact storage hosts are the exception: GitHub adds them over time, so the `ArtifactHosts` job reads them from `gh api meta` on every run. Hosts the deploy must reach anyway, such as GitHub, npm and the Cloudflare API, remain usable with an attacker's own account, so the allowlist narrows exfiltration rather than ruling it out.

The Worker configuration lives in `wrangler.json`, and `Deploy` checks out only that file, `mise.toml` and the files that pin wrangler (`deploy/package.json` and the workspace lockfile) to deploy from. The build is driven by `@cloudflare/vite-plugin`, which also generates a deployable config under `dist/`; that generated copy is deliberately kept out of the artifact and never deployed, since a wrangler config can carry a `build.command` that wrangler executes.

## Secrets & environment

Three separate places hold secrets, and a value set in one is not visible to the others:

- **Local development** — `.dev.vars` (and `.dev.vars.<env>`) holds the values the Worker runtime reads while `pnpm dev` runs. When `.dev.vars` is absent, the Vite plugin falls back to reading `.env*` as runtime secrets. Both families are gitignored, along with anything they would be renamed to; `*.example` files stay trackable so a template can be committed.
- **Deployed Worker** — set through the Cloudflare dashboard or `wrangler secret put <NAME>`. Previews run on the separate `<name>-preview` Worker, which does not see production's secrets: set each secret there too (`wrangler secret put <NAME> --env preview`), and repeat any `vars` or bindings under `env.preview` in `wrangler.json`, since wrangler does not inherit them into an environment. `.dev.vars` is never uploaded: the build lists it in `dist/.assetsignore`, the artifact excludes it, and `Deploy` re-checks it is gone before running.
- **The deploy workflow itself** — the `CLOUDFLARE_API_TOKEN` environment secrets on `production` and `preview` from [After using this template](#after-using-this-template). They only authorise the deploy; the Worker cannot read them at runtime.

## Growing the codebase

The template ships with a minimal Counter demo under `src/` (a component, a hook, a utility, and unit tests for the hook and the component) to demonstrate the testing setup. The component applies its count colour through `src/utils/cn.ts`, the `clsx` + `tailwind-merge` helper: the conditional class overrides the base one rather than both surviving into the DOM, which is the reason to reach for it over a plain string. There is deliberately no imposed directory structure beyond `hooks/`, `utils/`, and `styles/` — introduce feature-oriented boundaries (e.g. `src/features/<name>/`) once the app has more than a handful of screens, and delete the Counter demo when you start building. `e2e-tests/index.spec.ts` drives that demo — replace those tests with ones for your own first screen when it goes.

## License

MIT
