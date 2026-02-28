# Chess Engine

## Overview

The chess logic lives in `src/chess/` and is separated from the UI. It provides board representation, full game state, legal move generation with check filtering, and a stateful `ChessEngine` class supporting FEN, UCI, and SAN notation.

## Board Representation

**Location:** `src/chess/types.ts`

The board is a flat 64-element array where each element is either a `Piece` or `null`.

```
index = file + rank * 8
```

- `file`: 0-7 (a-h, left to right)
- `rank`: 0-7 (1-8, bottom to top)
- Rank 0 = white's back rank (bottom)
- Rank 7 = black's back rank (top)

### Types

```typescript
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type PieceColor = 'white' | 'black';

interface Piece {
  type: PieceType;
  color: PieceColor;
}

type Board = (Piece | null)[];  // length 64

interface CastlingRights {
  K: boolean;  // white kingside
  Q: boolean;  // white queenside
  k: boolean;  // black kingside
  q: boolean;  // black queenside
}

interface GameState {
  board: Board;
  activeColor: PieceColor;
  castlingRights: CastlingRights;
  enPassantSquare: number | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}
```

### Starting Position

`getStartingGameState()` returns a standard chess starting `GameState`:
- Rank 0: white back rank (R, N, B, Q, K, B, N, R)
- Rank 1: white pawns
- Rank 6: black pawns
- Rank 7: black back rank
- All castling rights enabled, en passant null, clocks at 0/1

## Move Calculation

**Location:** `src/chess/rules.ts`

### `getLegalMoves(state, fromIndex): number[]`

Returns an array of valid destination indices for the piece at `fromIndex`. All returned moves are verified to not leave the player's own king in check.

### `isInCheck(state, color): boolean`

Returns whether the given color's king is currently attacked.

### `isCheckmate(state, color): boolean`

Returns whether the given color is in checkmate (in check with no legal moves).

### `isStalemate(state, color): boolean`

Returns whether the given color is stalemated (not in check but no legal moves).

### Movement Rules

| Piece | Logic |
|-------|-------|
| **Pawn** | 1 forward, 2 from starting rank, diagonal capture, en passant, promotion on back rank. |
| **Knight** | L-shaped jumps (8 possible). Can jump over pieces. |
| **Bishop** | Diagonal sliding (4 directions). Blocked by first piece. |
| **Rook** | Orthogonal sliding (4 directions). Blocked by first piece. |
| **Queen** | Combined bishop + rook movement. |
| **King** | 1 square in any direction (8 possible). Castling kingside/queenside when conditions met. |

All pieces can capture opponent pieces but not friendly ones.

### Implementation Notes

- Sliding pieces (bishop, rook, queen) use a shared `slideMoves()` helper
- Queen is implemented as bishop + rook moves combined
- All moves are filtered through check validation — a move is only legal if it doesn't leave the king in check
- Castling requires: king and rook unmoved, no pieces between them, king not in check, king doesn't pass through check
- En passant captures use the `enPassantSquare` from `GameState`

## ChessEngine Class

**Location:** `src/chess/engine.ts`

Stateful game engine that manages `GameState` and move history. Used as the single source of truth for the game, instantiated in `Home.tsx` via `useRef`.

### API

```typescript
class ChessEngine {
  constructor()                   // Starts with standard position

  reset(fisher?: boolean): void   // Reset to standard or Chess960 position
  getFEN(): string                // Export current state as FEN string
  setFEN(fen: string): void       // Import state from FEN string (throws on invalid)

  moveUCI(uci: string): Result    // Execute move in UCI format (e.g. "e2e4", "e7e8q")
  moveSAN(san: string): Result    // Execute move in SAN format (e.g. "e4", "Nf3", "O-O", "exd5")

  getSAN(): string[]              // Get full move history as SAN strings
  getState(): GameState           // Get cloned current state
  getHistory(): MoveRecord[]      // Get cloned move history
}

// Result type (discriminated union)
type Result = { success: true } | { success: false; error: string }
```

### moveSAN

Parses Standard Algebraic Notation and resolves it to UCI by:
1. Stripping `+`/`#` suffixes
2. Handling castling (`O-O`, `O-O-O`, `0-0`, `0-0-0`)
3. Parsing piece prefix (`KQRBN`, pawn if absent)
4. Extracting disambiguation (file/rank), capture marker, target square, promotion
5. Searching all pieces of the matching type/color for one with a legal move to the target
6. Delegating to `moveUCI`

### Chess960 (Fischer Random)

`reset(true)` generates a valid Chess960 starting position:
- Bishops placed on opposite-colored squares
- King placed between the two rooks
- Both sides get identical back ranks

### Move History

Each move is recorded as a `MoveRecord` with piece, color, from/to indices, captured piece, promotion, castling flags, and the state before the move (used for SAN disambiguation and check suffix calculation).

## Integration with UI

The `ChessEngine` instance lives in `Home.tsx` and drives the game:

```
Home (engineRef, gameState, sanMoves)
├── Header (onReset → engine.reset + chat system message)
├── Toolbar (sanMoves displayed as notation)
└── Arena (gameState, onMove)
    ├── ChessBoard (gameState, onMove → engine.moveUCI)
    └── GameChat (ref: addSystemMessage, clear)
```

- **Drag-and-drop moves**: `ChessBoard` calls `onMove(from, to)` → `Home.handleMove` converts to UCI → `engine.moveUCI()` → updates state + sends SAN to chat
- **Reset**: Header Reset button calls `engine.reset()` (long-press for Chess960) → clears chat → sends system message with mode and FEN
- **Notation bar**: Toolbar displays `engine.getSAN()` in real-time

## Chess UI Components

**Location:** `src/components/chess/`

| Component | Purpose |
|-----------|---------|
| `ChessBoard` | Renders 8x8 grid, accepts `gameState` + `onMove` props, manages drag-and-drop via @dnd-kit, highlights legal moves |
| `ChessSquare` | Single square, handles drop target and click selection |
| `ChessPiece` | Draggable piece, renders Unicode chess symbol |

The board uses @dnd-kit for drag-and-drop interactions:
- `DndContext` wraps the board
- Each `ChessPiece` is a draggable element
- Each `ChessSquare` is a droppable target
- Legal moves are highlighted when a piece is selected or being dragged
- On drop, `onMove(from, to)` is called — the parent routes it through `ChessEngine`

## Test Coverage

**47 tests** across `engine.test.ts`, `rules.test.ts`, and `types.test.ts` covering:
- Starting position, reset, Chess960 generation
- FEN round-tripping and validation
- UCI move execution (legal, illegal, wrong turn, castling, promotion)
- SAN move execution (pieces, pawns, captures, castling, promotion, disambiguation, error cases)
- SAN output (notation, check `+`, checkmate `#`, disambiguation)
- State updates (en passant, halfmove clock, fullmove number, castling rights)
- Legal move generation for all piece types with check filtering
