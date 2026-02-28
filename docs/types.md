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
type MessageSender = 'system' | 'player' | 'user';
```

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
  content: string;
  toolCalls?: ToolCallData[];        // Present when LLM makes a move
}
```

Single message in a player's conversation history.

### PlayerConfig

```typescript
interface PlayerConfig {
  name: string;                      // Display name
  color: ChessColor;
  model: string;                     // OpenRouter model ID
  systemPrompt: string;
}
```

Configuration for creating a `ChessPlayer` instance.

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
  clear: () => void;
}
```

Imperative handle exposed by `GameChat` via `forwardRef` + `useImperativeHandle`. Used by `Home` to push system messages (move results, reset notifications) into the chat.
