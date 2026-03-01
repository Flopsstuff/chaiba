# Types Reference

## Global Types (`src/types/index.ts`)

### ChessColor

```typescript
type ChessColor = 'white' | 'black';
```

### PlayerStatus

```typescript
type PlayerStatus = 'idle' | 'thinking' | 'error';
```

State of an AI player during a game session.

### MessageSender

```typescript
type MessageSender = 'system' | 'moderator' | 'agent';
```

### MoveCommand

```typescript
const MoveCommand: String = '<make your move now>';
```

Constant used in system prompts to signal when a player should submit their move via the `make-move` tool.

### ToolCallData

```typescript
interface ToolCallData {
  id: string;                        // Unique tool call ID
  tool: string;                      // Tool name (e.g. 'make-move')
  args: Record<string, unknown>;     // Tool arguments
}
```

Normalized representation of an LLM tool call response.

### Message

```typescript
interface Message {
  sender: MessageSender;
  agentId?: string;                  // ID of the agent that sent/owns this message
  agentName?: string;                // Display name of the agent
  content: string;
  toolCalls?: ToolCallData[];        // Present when LLM makes a move
  toolResultFor?: {                  // Present for tool result messages
    callId: string;
    toolName: string;
  };
  moveNumber?: number;               // Engine's fullmoveNumber (context messages only)
  moveColor?: ChessColor;            // Whose turn it is (context messages only)
}
```

Single message in the shared conversation history. The `agentId` field associates messages with specific agents, enabling per-agent filtering and opponent message handling.

The `moveNumber` and `moveColor` fields are set on context messages (containing `MoveCommand`) and used by the Anthropic prompt caching logic to place cache breakpoints at the correct position without string parsing.

### PlayerConfig

```typescript
interface PlayerConfig {
  name: string;                      // Display name
  color: ChessColor;
  model: string;                     // OpenRouter model ID
  systemPrompt: string;
  fischer960?: boolean;              // Whether playing Chess960 mode
}
```

Configuration for creating a `ChessPlayer` instance. The `fischer960` flag is dynamically synced to the player via `useChessPlayer`.

## Chess Types (`src/chess/types.ts`)

### PieceType

```typescript
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
```

### PieceColor

```typescript
type PieceColor = 'white' | 'black';
```

### Piece

```typescript
interface Piece {
  type: PieceType;
  color: PieceColor;
}
```

### Board

```typescript
type Board = (Piece | null)[];  // length 64, index = file + rank * 8
```

### CastlingRights

```typescript
interface CastlingRights {
  K: boolean;   // white kingside
  Q: boolean;   // white queenside
  k: boolean;   // black kingside
  q: boolean;   // black queenside
}
```

### GameState

```typescript
interface GameState {
  board: Board;
  activeColor: PieceColor;
  castlingRights: CastlingRights;
  enPassantSquare: number | null;  // target square index, or null
  halfmoveClock: number;
  fullmoveNumber: number;
}
```

Full game state matching FEN fields. Used by `ChessEngine`, `ChessBoard`, and `Arena`.

## Component Types

### GameChatHandle (`src/components/chat/GameChat.tsx`)

```typescript
interface GameChatHandle {
  addSystemMessage: (text: string) => void;
  addAgentMessage: (name: string, color: 'white' | 'black', text: string) => void;
  clear: () => void;
}
```

Imperative handle exposed by `GameChat` via `forwardRef` + `useImperativeHandle`. Used by `Home` to push system messages (move results, reset notifications) and agent messages into the chat.
