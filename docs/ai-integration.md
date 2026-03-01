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
  generate(messages: Message[], opponent?: { name: string; color: ChessColor }): Promise<{ text: string; toolCalls: ToolCallData[] }>;
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

For Anthropic models (`anthropic/*`), the first two messages are annotated with `cacheControl: { type: 'ephemeral' }` to enable prompt caching via OpenRouter.

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
  generate: (messages: Message[], opponent?: { name: string; color: ChessColor }) => Promise<{ text: string; toolCalls: ToolCallData[] }>;
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
1. Parent component calls generate(messages, opponent)
2. useChessPlayer sets status → 'thinking'
3. ChessPlayer.convertMessages() transforms shared Message[] to LLM format
4. generateText() calls OpenRouter API
5. LLM returns text + make-move tool call
6. Tool call parsed into ToolCallData
7. Log entry appended to messageLog (request + response + usage)
8. useChessPlayer syncs status/messageLog to React state
9. Parent adds agent response + tool result to shared messages
10. Panel renders MessageBubble with move + reasoning
```

## Configuration

All configuration is stored in `localStorage`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `openrouter_api_key` | `string` | — | OpenRouter API key (required) |
| `selected_models` | `JSON array` | — | Selected models from OpenRouter catalog |
| `chess_prompts` | `JSON object` | — | Custom system prompts per color |

Model selection falls back to `openai/gpt-4o` if no models are configured.
