## Context

CHAIBA has a 3-panel layout (WhitePanel | Arena | BlackPanel) but the panels are empty placeholders. The existing `src/lib/openrouter.ts` provides an OpenRouter provider factory reading the API key from localStorage. The `temp/aimaf/` codebase demonstrates a working multi-agent pattern: `ChatAgent` class with tool calls, per-agent message history, status tracking, and a React hook for orchestration. We adapt this pattern for chess.

## Goals / Non-Goals

**Goals:**
- Reusable `ChessPlayer` class that wraps Vercel AI SDK for a single chess agent
- `make-move` tool so the model returns structured move data (algebraic notation) rather than free text
- Per-player chat history visible in respective panels
- Player status observable from UI (`idle`, `thinking`, `error`)
- System prompt system (`ChessPrompts`) configurable per color/style
- React hook to bridge `ChessPlayer` into component state

**Non-Goals:**
- Chess rule validation or legal move enforcement (future: chess engine integration)
- Game orchestration / turn management (separate concern, later change)
- Board rendering or move animation
- ELO rating or match history persistence

## Decisions

### 1. Class-based agent (`ChessPlayer`) vs functional approach

**Choice:** Class wrapping a Vercel AI SDK model instance, similar to `ChatAgent` from aimaf.

**Why:** The agent has identity (name, color, model), mutable state (status, chat history), and methods (generate, reset). A class groups these naturally. Matches the reference pattern the codebase already demonstrates.

**Alternative:** Pure functions + external state in a hook. Rejected because it scatters agent logic across hook and utility files.

### 2. Tool-based move output vs text parsing

**Choice:** Define a `make-move` tool with Zod schema (`{ move: string, reasoning?: string }`). The model calls this tool to submit its move.

**Why:** Structured output is reliable. Free-text parsing of chess notation is fragile — models vary in formatting. The AI SDK tool loop handles retries if the model doesn't call the tool correctly.

**Alternative:** `generateObject` with a Zod schema for the entire response. Less natural for chat-style interaction where the model should also explain its thinking in text.

### 3. Message history — per-player array vs shared store

**Choice:** Each `ChessPlayer` holds its own `Message[]` array. The hook exposes it to the panel component.

**Why:** Players don't see each other's reasoning chat. Keeping histories separate avoids filtering logic and matches the UI (each panel shows one player's chat). System messages (game state, board position) are pushed into both histories when needed.

**Alternative:** Single shared message store with visibility flags (like aimaf). Overkill for two players with no cross-visibility.

### 4. Status model

**Choice:** Simple enum: `idle` | `thinking` | `error`. Stored as a property on `ChessPlayer`, updated before/after `generate()`.

**Why:** Minimal and sufficient. The UI needs to show a spinner while the model is generating and display errors. No need for queued/cancelled states yet.

### 5. Prompt structure (`ChessPrompts`)

**Choice:** Static class with a base chess prompt + color-specific instructions. Custom instructions can be appended. Prompts stored/loaded from localStorage for user customization.

**Why:** Follows the `MafiaPrompts` pattern. Separating prompts from the agent class keeps configuration flexible and testable.

### 6. Hook design (`useChessPlayer`)

**Choice:** One hook per player. Each hook creates a `ChessPlayer` instance, manages its React state (messages, status), and exposes `generate()` / `reset()` methods.

**Why:** WhitePanel and BlackPanel are independent components. One hook per panel keeps them decoupled. The parent (Home) doesn't need to coordinate them for this change (orchestration is a non-goal).

## Risks / Trade-offs

- **No move validation** → The model can return illegal moves. Mitigation: this is explicitly a non-goal; a future chess engine integration change will handle validation.
- **localStorage-only API key** → No server-side proxy, API key is in the browser. Mitigation: acceptable for a client-side demo app. Already the established pattern.
- **No streaming** → Using `generateText` (not `streamText`) for simplicity. Mitigation: can switch to streaming later without changing the class interface — just the internal `generate()` implementation.
- **Two independent hooks, no shared coordination** → No turn enforcement between players. Mitigation: game orchestration is a separate future change that will sit above both hooks.
