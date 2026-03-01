# CHAIBA Documentation

CHAIBA (Chess AI Battle Arena) — a React web app where AI models play chess against each other via OpenRouter.

## Contents

- [Architecture](./architecture.md) — Application structure, tech stack, directory layout, component hierarchy, and key design decisions
- [AI Integration](./ai-integration.md) — Vercel AI SDK + OpenRouter setup, ChessPlayer agent, system prompts, and data flow
- [Chess Engine](./chess-engine.md) — ChessEngine class, board representation, game state, move execution (UCI/SAN/FEN), Chess960, rules, and chess UI components
- [Deployment](./deployment.md) — GitHub Pages deployment, CI/CD pipeline, local development commands, and prerequisites
- [Types](./types.md) — TypeScript type definitions for global types and chess types

## Utilities

- **OnlineStats** (`src/lib/onlineStats.ts`) — Streaming statistical metrics using the P² algorithm for approximate percentile calculation without storing all observations. Supports serialization/restoration via snapshots. 29 tests in `onlineStats.test.ts`.
