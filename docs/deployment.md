# Deployment

## GitHub Pages

The app is deployed to GitHub Pages at:
**https://flopsstuff.github.io/chaiba/**

## CI/CD Pipeline

**Workflow:** `.github/workflows/deploy.yml`

### Trigger

- Push to `main` branch
- Manual dispatch (`workflow_dispatch`)

### Build Steps

1. Checkout code
2. Setup Node.js v22
3. `corepack enable` — activate the pinned Yarn 4 version
4. `yarn install --immutable` — install dependencies from `yarn.lock`
5. `yarn build` — Vite production build to `dist/`
6. Upload the `dist/` artifact
7. Deploy to GitHub Pages

### Important Notes

- **Base path.** The Vite `base` is set to `/chaiba/` in `vite.config.ts` so all
  asset URLs resolve under the GitHub Pages project subpath. This replaces the
  old CRA `PUBLIC_URL=/chaiba` environment variable — there is no longer a
  `PUBLIC_URL` to set.
- **Hash routing is required.** GitHub Pages doesn't support server-side routing,
  so `HashRouter` ensures all routes work as `/#/path`.
- **Build output is `dist/`** (Vite default), not `build/` (the old CRA default).
- Concurrency group `"pages"` prevents parallel deployments.

## Local Development

This project uses **Yarn 4** (via Corepack) and **Vite**.

```bash
corepack enable     # one-time
yarn install        # install dependencies
yarn dev            # Vite dev server at http://localhost:5173/chaiba/
yarn build          # production build to ./dist
yarn preview        # serve the production build locally
yarn test           # run the Vitest suite
```

## Prerequisites

- Node.js v22+
- Yarn 4 (Corepack)
- OpenRouter API key (configured in the app's Settings page)
