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
2. Setup Node.js v23.8.0
3. `npm ci` — install dependencies
4. `npm run build` — build with:
   - `PUBLIC_URL=/chaiba` — assets served from `/chaiba/` subdirectory
   - `DISABLE_ESLINT_PLUGIN=true` — avoids ESLint CI failures in strict mode
5. Upload build artifact
6. Deploy to GitHub Pages

### Important Notes

- **Hash routing is required.** GitHub Pages doesn't support server-side routing, so `HashRouter` ensures all routes work as `/#/path`.
- **PUBLIC_URL** must match the repository name (`/chaiba`) for asset paths to resolve correctly.
- Concurrency group `"pages"` prevents parallel deployments.

## Local Development

```bash
npm start          # Dev server at localhost:3000
npm run build      # Production build to /build
npm run serve      # Build + serve locally
npm test           # Run tests
```

## Prerequisites

- Node.js v23+
- OpenRouter API key (configured in the app's Settings page)
