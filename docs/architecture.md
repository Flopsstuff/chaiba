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
│   ├── engine.ts         # ChessEngine class (FEN, UCI, SAN, reset, Chess960)
│   ├── types.ts          # Piece, Board, GameState, CastlingRights
│   └── rules.ts          # getLegalMoves, isInCheck, isCheckmate, isStalemate
├── components/
│   ├── Header.tsx/.css       # App header with navigation + total cost display
│   ├── GitHubLogo.tsx/.css   # GitHub link icon
│   ├── ColorSpinner.tsx/.css # Animated spinner with color (white/black)
│   ├── chess/                # Chess board UI
│   │   ├── ChessBoard.tsx/.css  # Interactive board (@dnd-kit)
│   │   ├── ChessSquare.tsx      # Single square
│   │   └── ChessPiece.tsx       # Draggable piece
│   ├── chat/
│   │   └── GameChat.tsx/.css    # Chat interface (system messages via ref)
│   └── panels/
│       ├── Arena.tsx/.css       # Central game area
│       ├── AgentCard.tsx/.css   # Reusable agent config + messages + debug log card
│       ├── WhitePanel.tsx/.css  # White player panel (wraps AgentCard)
│       ├── BlackPanel.tsx/.css  # Black player panel (wraps AgentCard)
│       └── MessageBubble.tsx    # Chat message display
├── hooks/
│   └── useChessPlayer.ts   # React hook wrapping ChessPlayer
├── lib/
│   ├── openrouter.ts        # OpenRouter provider factory
│   ├── models.ts            # Model selection from localStorage
│   └── onlineStats.ts       # Streaming statistical metrics (P² algorithm)
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
    ├── Home (owns ChessEngine instance, gameState, sanMoves, isFischer)
    │   ├── Header (onReset — click: standard, long-press: Chess960)
    │   │   └── GitHubLogo
    │   ├── Toolbar (toggle buttons + SAN notation display)
    │   ├── WhitePanel (left, collapsible, fischer960)
    │   │   └── AgentCard (color, messages, fischer960)
    │   │       ├── ColorSpinner (color, spinning)
    │   │       └── MessageBubble[]
    │   ├── Arena (center, forwards ref to GameChat)
    │   │   ├── ChessBoard (gameState, onMove)
    │   │   │   └── ChessSquare[] + ChessPiece[]
    │   │   └── GameChat (imperative handle: addSystemMessage, addAgentMessage, clear; FEN/SAN buttons)
    │   └── BlackPanel (right, collapsible, fischer960)
    │       └── AgentCard (color, messages, fischer960)
    │           ├── ColorSpinner (color, spinning)
    │           └── MessageBubble[]
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
   - `send_context_message` — whether to include FEN/move history before each move
   - `retry_attempts` — number of retry attempts on invalid move (0 = disabled)
   - `send_fen_on_error` — whether to include FEN in error context when retrying

3. **`ChessEngine` instance** — owned by `Home` via `useRef`:
   - Single source of truth for game state and move history
   - `gameState` and `sanMoves` synced to React state after each move/reset
   - GameChat controlled via imperative ref (`addSystemMessage`, `addAgentMessage`, `clear`)

4. **`useChessPlayer` hook** — bridges `ChessPlayer` class and React state:
   - Lazy-initializes `ChessPlayer` via `useRef`
   - Dynamically syncs mutable config (`name`, `model`, `systemPrompt`, `fischer960`)
   - Returns `{ id, name, status, error, messageLog, generate, clearLog }`

## AI Integration

See [ai-integration.md](./ai-integration.md) for details.

## Layout

The Home page uses a responsive 3-column flexbox layout with a toolbar above:

```
┌─────────────────────────────────────┐
│  ◀ White │  Notation area  │ Black ▶│  ← Toolbar
├──────────┬───────────────┬──────────┤
│          │               │          │
│  White   │    Arena      │  Black   │
│  Panel   │  (ChessBoard  │  Panel   │
│          │   + GameChat) │          │
│          │               │          │
└──────────┴───────────────┴──────────┘
```

The toolbar contains toggle buttons for each side panel and a central notation area displaying live SAN move history from the engine. Clicking the notation area copies move history to clipboard. Side panels are toggled via the toolbar buttons. At the 768px breakpoint, panels start collapsed.

The GameChat controls include:
- **Reset** button with dual behavior: click for standard reset, long-press (600ms) for Chess960
- **Move** buttons (white/black) to trigger agent moves
- **Auto** checkbox for auto-play mode
- **FEN** button — sends current board position (FEN) to chat as a moderator message
- **SAN** button — sends move history to chat as a moderator message

The Header displays the cumulative API cost for the current game session.

## Key Architectural Decisions

1. **Hash routing** — enables GitHub Pages deployment without server configuration
2. **No state library** — local state + localStorage is sufficient for current complexity
3. **Flat board array** — 64-element array (index = file + rank * 8) is simpler than 2D for move calculations
4. **Tool-based moves** — LLM returns chess moves via Vercel AI SDK tool calls, not free text parsing
5. **Class + hook pattern** — `ChessPlayer` class holds logic; `useChessPlayer` hook bridges it to React rendering
6. **Component-scoped CSS** — each component has a paired CSS file, no CSS-in-JS overhead
7. **AgentCard abstraction** — shared `AgentCard` component handles model selection, prompt display, message rendering, call cost tracking, and debug message log for both white and black panels, reducing duplication
8. **Manual moves as agent messages** — board drag-and-drop moves are recorded as fake tool-call + tool-result pairs in sharedMessages, so both agents see them through the standard `convertMessages()` routing
9. **Structured cache control** — Anthropic prompt caching uses `Message.moveNumber` metadata rather than string parsing, keeping the caching logic decoupled from message content format
