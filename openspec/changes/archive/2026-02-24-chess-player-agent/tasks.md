## 1. Types

- [x] 1.1 Create `src/types/index.ts` with shared types: `ChessColor`, `PlayerStatus`, `PlayerConfig`, `Message` (sender, content, toolCalls), `ToolCallData`

## 2. ChessPrompts

- [x] 2.1 Create `src/agents/ChessPrompts.ts` with base chess system prompt and color-specific sections (white/black)
- [x] 2.2 Add `getSystemPrompt(color, customInstructions?)` method composing base + color + custom text
- [x] 2.3 Add localStorage load/save for custom prompt templates (`chess_prompts` key)

## 3. ChessPlayer class

- [x] 3.1 Create `src/agents/ChessPlayer.ts` with constructor accepting `PlayerConfig` and API key validation
- [x] 3.2 Implement `make-move` tool definition with Zod schema `{ move: string, reasoning?: string }`
- [x] 3.3 Implement `generate()` method: status transitions (`idle` → `thinking` → `idle`/`error`), call `generateText` with OpenRouter model and tools, return text + tool calls
- [x] 3.4 Implement message history: append prompt/response on each `generate()`, `addSystemMessage(content)`, `reset()` to clear history and status

## 4. useChessPlayer hook

- [x] 4.1 Create `src/hooks/useChessPlayer.ts` — instantiate ChessPlayer, expose messages/status/error as React state
- [x] 4.2 Implement `generate(prompt)` wrapper that updates React state on status changes and appends messages
- [x] 4.3 Implement `reset()` wrapper that clears state and calls player reset

## 5. Panel UI integration

- [x] 5.1 Update `WhitePanel.tsx` to mount `useChessPlayer` with white config, render chat messages and status indicator
- [x] 5.2 Update `BlackPanel.tsx` to mount `useChessPlayer` with black config, render chat messages and status indicator
- [x] 5.3 Add CSS for chat message list, sender indicators, thinking spinner, and error display in panel styles
