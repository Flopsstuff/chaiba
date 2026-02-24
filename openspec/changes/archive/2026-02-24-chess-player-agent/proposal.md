## Why

The arena has panels for White and Black players but no agent behind them. We need a ChessPlayer class — an AI agent powered by OpenRouter — that can reason about chess positions, communicate via chat, and produce moves. This is the core building block that makes the battle arena functional.

## What Changes

- New `ChessPlayer` class wrapping Vercel AI SDK + OpenRouter provider, modeled after the `ChatAgent` pattern from `temp/aimaf/`
- Each player is configurable with a system prompt, model selection, and display name
- Player status lifecycle: `idle` → `thinking` → `idle` / `error`
- Chess-specific tool: `make-move` tool (returns a move in algebraic notation) validated by Zod schema
- Per-player message history (chat) so each agent maintains its own conversation context
- Message visibility rules: each player sees only their own chat, system announcements are shared
- Two instances wired into the UI: one in WhitePanel, one in BlackPanel
- React hook (`useChessPlayer` or similar) to manage player state, chat, and API calls from components

## Capabilities

### New Capabilities
- `chess-player`: ChessPlayer agent class — configuration, status, system prompt, model, chat history, move generation via tool calls
- `chess-player-ui`: UI integration — mounting players into White/Black panels, displaying chat and status, player controls

### Modified Capabilities

_(none — no existing specs)_

## Impact

- **New files:** `src/agents/ChessPlayer.ts`, `src/agents/ChessPrompts.ts`, `src/hooks/useChessPlayer.ts`, `src/types/index.ts`
- **Modified files:** `src/components/panels/WhitePanel.tsx`, `src/components/panels/BlackPanel.tsx`
- **Dependencies:** already present (`ai`, `@openrouter/ai-sdk-provider`, `zod`). No new packages needed.
- **API:** uses OpenRouter API key from localStorage (`openrouter_api_key`)
