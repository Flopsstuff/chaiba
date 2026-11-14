# Deployment

## Cloudflare Workers

The app is deployed as a static-assets Cloudflare Worker (`chaiba`) on its own
domain:
**https://chaiba.flopbut.pl/**

Worker configuration lives in `wrangler.jsonc`: it serves the `dist/` directory
and binds the custom domain `chaiba.flopbut.pl` (zone `flopbut.pl`). The
`custom_domain` route creates the DNS record and certificate on deploy. The
`*.workers.dev` address is not enabled.

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
6. `yarn wrangler deploy` — upload `dist/` to Cloudflare

### Repository secrets

- `CLOUDFLARE_API_TOKEN` — API token with the "Edit Cloudflare Workers"
  template, scoped to the `flopbut.pl` zone
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id

### Important Notes

- **Base path.** The Vite `base` is `/` in `vite.config.ts`: the app is served
  from the root of its domain.
- **Hash routing.** The app uses `HashRouter`, so all routes work as `/#/path`
  and no server-side SPA fallback is needed.
- **Build output is `dist/`** (Vite default).
- Concurrency group `"deploy"` prevents parallel deployments.

### Manual deploy

```bash
yarn build && yarn wrangler deploy   # requires `wrangler login`
```

## Local Development

This project uses **Yarn 4** (via Corepack) and **Vite**.

```bash
corepack enable     # one-time
yarn install        # install dependencies
yarn dev            # Vite dev server at http://localhost:5173/
yarn build          # production build to ./dist
yarn preview        # serve the production build locally
yarn test           # run the Vitest suite
```

## Prerequisites

- Node.js v22+
- Yarn 4 (Corepack)
- OpenRouter API key (configured in the app's Settings page)
