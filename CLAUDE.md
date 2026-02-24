# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CHAIBA (Chess AI Battle Arena) — a React web app where AI models play chess against each other via OpenRouter. Deployed to GitHub Pages at https://flopsstuff.github.io/chaiba/.

## Commands

- `npm start` — dev server
- `npm run build` — production build
- `npm test` — run Jest tests
- `npm run serve` — build and serve locally

## Tech Stack

- React 19 + TypeScript (strict mode) via Create React App
- React Router v7 with HashRouter (required for GitHub Pages)
- Vercel AI SDK + OpenRouter provider for LLM calls
- Zod for schema validation
- CSS files per component (BEM-inspired naming)

## Architecture

**Routing:** Hash-based (`HashRouter`) with two routes: `/` (Home) and `/settings` (Settings).

**State & persistence:** Local component state with `useState`/`useEffect`. API key and selected models stored in `localStorage` (`openrouter_api_key`, `selected_models`).

**AI integration:** `src/lib/openrouter.ts` creates an OpenRouter provider instance reading the API key from localStorage. Used with Vercel AI SDK's `ai` package.

**Layout:** Home page is a responsive 3-column layout (WhitePanel | Arena | BlackPanel) with collapsible side panels at the 768px breakpoint.

**Deployment:** GitHub Actions workflow builds with `PUBLIC_URL=/chaiba` and deploys to GitHub Pages. Node v20. ESLint plugin disabled during CI builds.

## Key Directories

- `src/pages/` — route-level page components (Home, Settings)
- `src/components/panels/` — game layout panels (Arena, WhitePanel, BlackPanel)
- `src/components/` — shared components (Header, GitHubLogo)
- `src/lib/` — API provider setup (OpenRouter)
