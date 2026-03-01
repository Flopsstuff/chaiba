# AI Integration

## Overview

CHAIBA uses the **Vercel AI SDK** with the **OpenRouter provider** to communicate with LLMs. Each chess player (white/black) is an independent `ChessPlayer` agent that maintains its own conversation history and makes moves via structured tool calls.

## Provider Setup

```
localStorage (API key)
       ↓
  createOpenRouter({ apiKey })     ← @openrouter/ai-sdk-provider
       ↓
  openrouter(modelId)              ← returns model instance
       ↓
  generateText({ model, ... })     ← ai (Vercel AI SDK)
```

**Key files:**
- `src/lib/openrouter.ts` — `getOpenRouterProvider()` factory function
- `src/lib/models.ts` — `getSelectedModel(index)` reads model selection from localStorage

## ChessPlayer Agent

**Location:** `src/agents/ChessPlayer.ts`

The `ChessPlayer` class encapsulates all LLM interaction for one player:

```typescript
class ChessPlayer {
  readonly id: string;              // Unique ID (crypto.randomUUID)
  name: string;                     // Mutable — synced from config
  readonly color: ChessColor;       // 'white' | 'black'
  model: string;                    // Mutable — synced from config
  systemPrompt: string;             // Mutable — synced from config
  fischer960: boolean;              // Whether playing Chess960 mode

  get status(): PlayerStatus;       // 'idle' | 'thinking' | 'error'
  get error(): string | null;
  get messageLog(): { timestamp: number; messages: unknown[] }[];

  clearLog(): void;
  generate(messages: Message[], opponent?: { name: string; color: ChessColor }, moveNumber?: number): Promise<{ text: string; toolCalls: ToolCallData[]; cost: number }>;
}
```

### Constructor

- Reads API key from `localStorage`
- Creates a dedicated OpenRouter provider instance (uses empty string if no key, throws on `generate` if missing)
- Assigns a unique `id` via `crypto.randomUUID()`

### Message Handling

The class does **not** store conversation messages internally. Instead, `generate()` receives the shared `Message[]` array and converts it to LLM-compatible messages via `convertMessages()`. Messages are routed based on `sender` and `agentId`:

| sender | agentId match | LLM role | Description |
|--------|---------------|----------|-------------|
| `agent` | own ID | `assistant` | This agent's own responses (with tool calls) |
| `agent` | other ID | `user` (prefixed `[@name]`) | Opponent's text messages |
| `system` | own ID or none | `user` (prefixed `[SYSTEM]`) | Game state and context |
| `system` | other ID | *(skipped)* | Opponent's context messages |
| `moderator` | — | `user` (prefixed `[MODERATOR]`) | Moderator messages |
| tool result | own ID | `tool` | Tool results for own calls |
| tool result | other ID | `user` (converted) | Opponent's moves → "Opponent played X" |

The conversion also prepends a game-start message pair that establishes the player's identity, color, and Chess960 mode.

### Message Log

Each `generate()` call appends a log entry with timestamp and the full request/response messages (including usage metadata). This powers the debug overlay in `AgentCard`.

### Anthropic Prompt Caching

For Anthropic models (`anthropic/*`), a single `cacheControl: { type: 'ephemeral' }` breakpoint is placed on a context message to enable prompt caching via OpenRouter. The breakpoint advances every 10 full moves (at moves 1, 11, 21, ...) so the cached prefix grows steadily with the game.

**How it works:**

1. `generate()` receives `moveNumber` (the engine's `fullmoveNumber`)
2. `convertMessages()` returns both the converted `ModelMessage[]` and a `moveCommandIndices` map — a `Map<index, moveNumber>` tracking which converted message indices are context messages and their associated move numbers
3. `addCacheBreakpoint()` calculates the boundary move: `floor((moveNumber - 1) / 10) * 10 + 1`
4. It looks up the last entry in `moveCommandIndices` whose move number is at or before the boundary
5. That message gets annotated with `cacheControl` — everything before it becomes a cached prefix

This approach uses structured data (`Message.moveNumber`) rather than string parsing, making it robust regardless of whether FEN/move history is included in context messages or not.

### Tool: `make-move`

The LLM communicates chess moves through a structured tool call:

```typescript
'make-move': tool({
  inputSchema: z.object({
    move: z.string(),          // Algebraic notation (e.g. "e4", "Nf3", "O-O")
    reasoning: z.string().optional(),  // Why the LLM chose this move
  }),
})
```

Tool calls are extracted from the response and returned as `ToolCallData[]`.

## React Hook: useChessPlayer

**Location:** `src/hooks/useChessPlayer.ts`

Bridges `ChessPlayer` class state into React rendering:

```typescript
function useChessPlayer(config: PlayerConfig): {
  id: string;
  name: string;
  status: PlayerStatus;
  error: string | null;
  messageLog: LogEntry[];
  generate: (messages: Message[], opponent?: { name: string; color: ChessColor }, moveNumber?: number) => Promise<{ text: string; toolCalls: ToolCallData[]; cost: number }>;
  clearLog: () => void;
}
```

- Lazy-initializes `ChessPlayer` instance via `useRef` (avoids re-creation on render)
- Dynamically syncs mutable config (`name`, `model`, `systemPrompt`, `fischer960`) to the player on each render
- Mirrors class state (`status`, `error`, `messageLog`) into React `useState` after each `generate` call
- `generate` sets status to `'thinking'` while awaiting the LLM

## System Prompts

**Location:** `src/agents/ChessPrompts.ts`

Prompts are structured as a base prompt (shared by both players) plus a color-specific prompt:

```typescript
interface ChessPromptsData {
  base: string;   // Shared rules and tool usage instructions
  white: string;  // White-specific strategy guidance
  black: string;  // Black-specific strategy guidance
}
```

The `ChessPrompts` class provides static methods:

| Method | Description |
|--------|-------------|
| `loadPrompts()` | Loads prompts from localStorage (falls back to `DEFAULT_PROMPTS`) |
| `savePrompts(prompts)` | Persists prompts to localStorage |
| `getBasePrompt(color)` | Returns combined base + color prompt |
| `getSystemPrompt(color, custom?)` | Returns full system prompt with optional custom instructions |

Custom prompts can be edited on the Settings page and are stored in localStorage under `chess_prompts`. The `AgentCard` component also allows per-agent custom instructions that are appended to the base prompt.

## Data Flow: AI Move

```
1. Home.handleAgentMove(color) builds context message with MoveCommand, moveNumber, moveColor
2. Calls agent.generate(messages, opponent, state.fullmoveNumber)
3. useChessPlayer sets status → 'thinking'
4. ChessPlayer.convertMessages() transforms shared Message[] to LLM format + moveCommandIndices map
5. ChessPlayer.addCacheBreakpoint() annotates cache breakpoint
6. generateText() calls OpenRouter API
7. LLM returns text + make-move tool call
8. Tool call parsed into ToolCallData, cost extracted from usage metadata
9. Log entry appended to messageLog (request + response + usage)
10. useChessPlayer syncs status/messageLog to React state
11. Home validates move via ChessEngine:
    - If valid: adds agent response + tool result to sharedMessages
    - If invalid and retries enabled: appends error feedback (optionally with FEN) and loops back to step 2
12. Panel renders MessageBubble with move + reasoning
```

### Retry on Invalid Move

When `retry_attempts` > 0 in Settings, `handleAgentMove` will retry the LLM call if the returned move is invalid or the agent responds without making a move:

- Up to N retry attempts (configurable 1-10 in Settings)
- Each retry appends the error message and optionally the current FEN (`send_fen_on_error`) to the conversation so the LLM can self-correct
- If all retries are exhausted, the move fails and auto-play stops

## Configuration

All configuration is stored in `localStorage`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `openrouter_api_key` | `string` | — | OpenRouter API key (required) |
| `selected_models` | `JSON array` | — | Selected models from OpenRouter catalog |
| `chess_prompts` | `JSON object` | — | Custom system prompts per color |
| `send_context_message` | `string` | `'true'` | Whether to include FEN + move history in context messages |
| `retry_attempts` | `string` | `'0'` | Number of retry attempts when agent makes an invalid move |
| `send_fen_on_error` | `string` | `'false'` | Whether to include current FEN in error feedback on invalid moves |

Model selection falls back to `openai/gpt-4o` if no models are configured.

## Manual Moves

When a user makes a move on the board (drag & drop), it is recorded in `sharedMessages` as a fake tool-call + tool-result pair from the corresponding agent. This ensures both agents see the move correctly:
- The agent whose color made the move sees it as its own tool call + result
- The opponent sees it as `"Opponent played X."` via the standard `convertMessages()` routing

## Cost Tracking

Each `generate()` call returns a `cost` field extracted from the OpenRouter response metadata (`usage.raw.cost`). Home accumulates total cost across both agents and displays it in the Header.
