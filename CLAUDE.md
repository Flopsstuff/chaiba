# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CHAIBA (Chess AI Battle Arena) — a React web app where AI models play chess against each other via OpenRouter. Deployed to GitHub Pages at https://flopsstuff.github.io/chaiba/.

## Commands

Project uses **yarn 4** (via `packageManager` in package.json, activated with `corepack enable`). Prefer `yarn` over `npm`. Build tooling is **Vite**.

- `yarn dev` — Vite dev server (served under base `/chaiba/`, e.g. http://localhost:5173/chaiba/)
- `yarn build` — production build to `dist/`
- `yarn preview` — serve the production build locally
- `yarn test` — run the Vitest unit suite
- `yarn typecheck` — type-check with `tsc --noEmit` (note: zod v4 emits type errors in node_modules — ignore those)
- `yarn lint` — run ESLint (flat config, `eslint.config.js`) over the repo

## Tech Stack

- React 19 + TypeScript (strict mode), built with Vite (`@vitejs/plugin-react`)
- Vitest for unit tests
- React Router v7 with HashRouter (required for GitHub Pages)
- Vercel AI SDK + OpenRouter provider for LLM calls
- Zod for schema validation
- CSS files per component (BEM-inspired naming)

## Architecture

**Routing:** Hash-based (`HashRouter`) with two routes: `/` (Home) and `/settings` (Settings).

**State & persistence:** Local component state with `useState`/`useEffect`. API key and selected models stored in `localStorage` (`openrouter_api_key`, `selected_models`).

**AI integration:** `src/lib/openrouter.ts` creates an OpenRouter provider instance reading the API key from localStorage. Used with Vercel AI SDK's `ai` package.

**Layout:** Home page is a responsive 3-column layout (WhitePanel | Arena | BlackPanel) with collapsible side panels at the 768px breakpoint.

**Deployment:** GitHub Actions workflow runs `yarn build` (Vite) and deploys the `dist/` artifact to GitHub Pages. The `/chaiba/` subpath is configured via `base` in `vite.config.ts` (not an env var). Node v22.

## Key Directories

- `src/pages/` — route-level page components (Home, Settings)
- `src/components/panels/` — game layout panels (Arena, WhitePanel, BlackPanel)
- `src/components/` — shared components (Header, GitHubLogo)
- `src/lib/` — API provider setup (OpenRouter)
