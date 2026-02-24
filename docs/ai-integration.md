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
  readonly name: string;
  readonly color: ChessColor;       // 'white' | 'black'
  readonly model: string;           // e.g. 'openai/gpt-4o'
  readonly systemPrompt: string;

  get status(): PlayerStatus;       // 'idle' | 'thinking' | 'error'
  get error(): string | null;
  get messages(): ReadonlyArray<Message>;

  generate(prompt: string): Promise<{ text: string; toolCalls: ToolCallData[] }>;
  addSystemMessage(content: string): void;
  reset(): void;
}
```

### Constructor

- Reads API key from `localStorage`
- Throws if no API key is configured
- Creates a dedicated OpenRouter provider instance

### Message History

Messages are stored in a flat array with three sender types:

| sender | role sent to LLM | Description |
|--------|-------------------|-------------|
| `user` | `user` | Prompts to the player |
| `player` | `assistant` | LLM responses |
| `system` | `user` (prefixed `[SYSTEM]:`) | Game state notifications |

System messages are sent as user messages with a `[SYSTEM]:` prefix rather than using the LLM's system role, keeping the system prompt separate.

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
  messages: ReadonlyArray<Message>;
  status: PlayerStatus;
  error: string | null;
  generate: (prompt: string) => Promise<{ text: string; toolCalls: ToolCallData[] }>;
  addSystemMessage: (content: string) => void;
  reset: () => void;
}
```

- Lazy-initializes `ChessPlayer` instance via `useRef` (avoids re-creation on render)
- Mirrors class state into React `useState` after each operation
- `generate` sets status to `'thinking'` while awaiting the LLM

## System Prompts

**Location:** `src/agents/ChessPrompts.ts`

Configurable system prompts define how each player behaves. Custom prompts can be saved in localStorage under `chess_prompts`.

## Data Flow: AI Move

```
1. Parent component calls generate(prompt)
2. useChessPlayer sets status → 'thinking'
3. ChessPlayer.generate() appends user message
4. generateText() calls OpenRouter API
5. LLM returns text + make-move tool call
6. Tool call parsed into ToolCallData
7. Response appended to message history
8. useChessPlayer syncs messages/status to React state
9. Panel renders MessageBubble with move + reasoning
```

## Configuration

All configuration is stored in `localStorage`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `openrouter_api_key` | `string` | — | OpenRouter API key (required) |
| `selected_models` | `JSON array` | — | Selected models from OpenRouter catalog |
| `chess_prompts` | `JSON object` | — | Custom system prompts per color |

Model selection falls back to `openai/gpt-4o` if no models are configured.
