# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CHAIBA (Chess AI Battle Arena) — a React web app where AI models play chess against each other via OpenRouter. Deployed to Cloudflare Workers (static assets) at https://chaiba.flopbut.pl/.

## Commands

Project uses **yarn 4** (via `packageManager` in package.json, activated with `corepack enable`). Prefer `yarn` over `npm`. Build tooling is **Vite**.

- `yarn dev` — Vite dev server (http://localhost:5173/)
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

**Routing:** Hash-based (`HashRouter`). `/` is a new game being set up, `/game/:id` a stored game, `/settings` the settings. `/` and `/game/:id` are one route (`src/pages/Game.tsx`) so the board is not remounted when a new game gets its id.

**State & persistence:** Local component state with `useState`/`useEffect`. API key, selected models, prompts and game options are stored in `localStorage` (`openrouter_api_key`, `selected_models`, …). Games are stored in IndexedDB.

**Game session:** `src/lib/session.ts` defines the complete record of one game as a single JSON document (zod schema): setup, players, status/result, moves, every LLM call with usage/cost/timing, the agents' shared conversation and the arena chat. A call's request is not stored in full — it is the first `historyCount` entries of `messages` plus the call's `input`.

- **Lifecycle:** a new game exists only in memory while it is set up. On the first move or message it is stored, and its id goes into the address (`/game/:id`). It is `finished` on checkmate or stalemate. Reset shows a new game; the old one stays stored.
- **Storage:** `src/lib/sessionStore.ts` — IndexedDB database `chaiba` with the full documents (`sessions`) and a light index for lists (`meta`), written together. `Home` saves after every change through a serialized latest-wins writer.
- **Tabs:** `src/lib/sessionLock.ts` — the tab showing a game holds a Web Lock on it, so different tabs can play different games. Opening a game that another tab holds offers to take it over; the previous tab then freezes.
- **UI:** `Game.tsx` picks what the tab shows (new game, stored game, busy/missing/error screens, the "continue" offer); `Home.tsx` is one game and lives exactly as long as it. The header's Games menu and the Games section of Settings list stored games; Settings also exports, imports and deletes them.

**AI integration:** `src/lib/openrouter.ts` creates an OpenRouter provider instance reading the API key from localStorage. Used with Vercel AI SDK's `ai` package.

**Layout:** Home page is a responsive 3-column layout (WhitePanel | Arena | BlackPanel) with collapsible side panels at the 768px breakpoint.

**Deployment:** GitHub Actions workflow runs `yarn build` (Vite) and then `yarn wrangler deploy`, which uploads `dist/` as a static-assets Cloudflare Worker (`wrangler.jsonc`) bound to the custom domain `chaiba.flopbut.pl`. The app is served from the domain root (`base: '/'` in `vite.config.ts`). Repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Node v22.

## Key Directories

- `src/pages/` — route-level page components (Home, Settings)
- `src/components/panels/` — game layout panels (Arena, WhitePanel, BlackPanel)
- `src/components/` — shared components (Header, GitHubLogo)
- `src/lib/` — API provider setup (OpenRouter)
