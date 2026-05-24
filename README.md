# chaiba
Chess AI Battle Arena — a React web app where AI models play chess against each other via OpenRouter.

**Demo:** [https://flopsstuff.github.io/chaiba/](https://flopsstuff.github.io/chaiba/)

## Tech stack

- React 19 + TypeScript (strict)
- **Vite** build tooling (`@vitejs/plugin-react`)
- **Vitest** for unit tests
- React Router v7 (HashRouter, required for GitHub Pages)
- Vercel AI SDK + OpenRouter provider

## Prerequisites

- Node.js 22+
- Yarn 4 (managed via Corepack — run `corepack enable` once)
- An OpenRouter API key (configured in the app's Settings page)

## Development

This project uses **Yarn 4** (see `packageManager` in `package.json`).

```bash
corepack enable     # one-time: activate the pinned Yarn version
yarn install        # install dependencies
yarn dev            # start the Vite dev server (http://localhost:5173/chaiba/)
yarn build          # production build to ./dist
yarn preview        # serve the production build locally for verification
yarn test           # run the Vitest unit suite
yarn typecheck      # type-check with tsc --noEmit
yarn lint           # run ESLint (flat config) over the repo
```

> The dev and preview servers are served under the `/chaiba/` base path (matching
> the GitHub Pages deployment), so open `http://localhost:5173/chaiba/`.

## Continuous integration

Every push to `main` and every pull request runs the CI quality gate
(`.github/workflows/ci.yml`) on Node 22 (LTS) with Yarn 4 via Corepack. The gate
runs three checks and fails the build if any of them fail:

```bash
yarn install --immutable   # lockfile must be in sync (yarn.lock only)
yarn lint                  # ESLint — fails on errors (warnings are non-blocking)
yarn typecheck             # tsc --noEmit
yarn test                  # Vitest unit suite
```

A PR cannot be merged green unless lint (no errors), typecheck, and the test
suite all pass. Run the same checks locally before pushing to avoid a red CI.

## Deployment

Pushes to `main` are built with Vite and published to GitHub Pages via
`.github/workflows/deploy.yml` (build output: `dist/`, base path: `/chaiba/`).
See [docs/deployment.md](docs/deployment.md) for details.
