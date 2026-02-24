# Architecture

## Overview

CHAIBA (Chess AI Battle Arena) is a React SPA where AI models play chess against each other via OpenRouter API. The app runs entirely in the browser — no backend server required.

**Live:** https://flopsstuff.github.io/chaiba/

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict mode) |
| UI | React 19, React Router v7 |
| Routing | HashRouter (GitHub Pages compatible) |
| State | React hooks + localStorage |
| Styling | Component-scoped CSS (BEM-inspired) |
| AI | Vercel AI SDK + OpenRouter provider |
| Validation | Zod |
| Drag & Drop | @dnd-kit |
| Build | Create React App (react-scripts) |
| Deploy | GitHub Actions -> GitHub Pages |

## Directory Structure

```
src/
├── agents/              # AI agent logic
│   ├── ChessPlayer.ts   # ChessPlayer class (LLM interaction)
│   └── ChessPrompts.ts  # System prompts for white/black players
├── chess/               # Chess game logic (no UI)
│   ├── types.ts          # Piece, Board, PieceColor, PieceType
│   └── rules.ts          # getLegalMoves (all piece movement rules)
├── components/
│   ├── Header.tsx/.css       # App header with navigation
│   ├── GitHubLogo.tsx/.css   # GitHub link icon
│   ├── chess/                # Chess board UI
│   │   ├── ChessBoard.tsx/.css  # Interactive board (@dnd-kit)
│   │   ├── ChessSquare.tsx      # Single square
│   │   └── ChessPiece.tsx       # Draggable piece
│   ├── chat/
│   │   └── GameChat.tsx/.css    # Chat interface
│   └── panels/
│       ├── Arena.tsx/.css       # Central game area
│       ├── WhitePanel.tsx/.css  # White player panel
│       ├── BlackPanel.tsx/.css  # Black player panel
│       └── MessageBubble.tsx    # Chat message display
├── hooks/
│   └── useChessPlayer.ts   # React hook wrapping ChessPlayer
├── lib/
│   ├── openrouter.ts        # OpenRouter provider factory
│   └── models.ts            # Model selection from localStorage
├── pages/
│   ├── Home.tsx/.css         # Main game page (3-column layout)
│   └── Settings.tsx/.css     # API key + model configuration
├── types/
│   └── index.ts             # Shared TypeScript types
├── App.tsx                  # Router setup (HashRouter)
└── index.tsx                # React entry point
```

## Routing

Hash-based routing via `HashRouter` (required for GitHub Pages — no server-side routing available).

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Home` | Main game interface |
| `/settings` | `Settings` | API key and model config |

## Component Hierarchy

```
App
└── HashRouter
    ├── Home
    │   ├── Header
    │   │   └── GitHubLogo
    │   ├── WhitePanel (left, collapsible)
    │   │   └── MessageBubble[]
    │   ├── Arena (center)
    │   │   ├── ChessBoard
    │   │   │   └── ChessSquare[] + ChessPiece[]
    │   │   └── GameChat
    │   └── BlackPanel (right, collapsible)
    │       └── MessageBubble[]
    └── Settings
        └── Header
```

## State Management

No global state library. State is managed through:

1. **React hooks** (`useState`, `useRef`, `useCallback`) — component-local state
2. **localStorage** — persistent configuration:
   - `openrouter_api_key` — API key for OpenRouter
   - `selected_models` — JSON array of selected model objects
   - `chess_prompts` — custom system prompts

3. **`useChessPlayer` hook** — bridges `ChessPlayer` class and React state:
   - Lazy-initializes `ChessPlayer` via `useRef`
   - Syncs class state (messages, status, error) into React state
   - Returns `{ messages, status, error, generate, addSystemMessage, reset }`

## AI Integration

See [ai-integration.md](./ai-integration.md) for details.

## Layout

The Home page uses a responsive 3-column flexbox layout:

```
┌──────────┬───────────────┬──────────┐
│          │               │          │
│  White   │    Arena      │  Black   │
│  Panel   │  (ChessBoard  │  Panel   │
│          │   + GameChat) │          │
│          │               │          │
└──────────┴───────────────┴──────────┘
```

At the 768px breakpoint, side panels collapse into toggleable overlays.

## Key Architectural Decisions

1. **Hash routing** — enables GitHub Pages deployment without server configuration
2. **No state library** — local state + localStorage is sufficient for current complexity
3. **Flat board array** — 64-element array (index = file + rank * 8) is simpler than 2D for move calculations
4. **Tool-based moves** — LLM returns chess moves via Vercel AI SDK tool calls, not free text parsing
5. **Class + hook pattern** — `ChessPlayer` class holds logic; `useChessPlayer` hook bridges it to React rendering
6. **Component-scoped CSS** — each component has a paired CSS file, no CSS-in-JS overhead
