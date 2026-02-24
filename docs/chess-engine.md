# Chess Engine

## Overview

The chess logic lives in `src/chess/` and is separated from the UI. It provides board representation, piece types, and legal move calculation.

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
```

### Starting Position

`getStartingPosition()` returns a standard chess starting position:
- Rank 0: white back rank (R, N, B, Q, K, B, N, R)
- Rank 1: white pawns
- Rank 6: black pawns
- Rank 7: black back rank

## Move Calculation

**Location:** `src/chess/rules.ts`

### `getLegalMoves(board, fromIndex): number[]`

Returns an array of valid destination indices for the piece at `fromIndex`. Returns `[]` if no piece at that index.

### Movement Rules

| Piece | Logic |
|-------|-------|
| **Pawn** | 1 forward, 2 from starting rank, diagonal capture. Direction depends on color. |
| **Knight** | L-shaped jumps (8 possible). Can jump over pieces. |
| **Bishop** | Diagonal sliding (4 directions). Blocked by first piece. |
| **Rook** | Orthogonal sliding (4 directions). Blocked by first piece. |
| **Queen** | Combined bishop + rook movement. |
| **King** | 1 square in any direction (8 possible). |

All pieces can capture opponent pieces but not friendly ones.

### Implementation Notes

- Sliding pieces (bishop, rook, queen) use a shared `slideMoves()` helper
- Queen is implemented as bishop + rook moves combined
- **Not yet implemented:** en passant, castling, pawn promotion, check/checkmate detection
- Move validation is for UI highlighting only — the LLM generates moves in algebraic notation independently

## Chess UI Components

**Location:** `src/components/chess/`

| Component | Purpose |
|-----------|---------|
| `ChessBoard` | Renders 8x8 grid, manages drag-and-drop via @dnd-kit, highlights legal moves |
| `ChessSquare` | Single square, handles drop target and click selection |
| `ChessPiece` | Draggable piece, renders Unicode chess symbol |

The board uses @dnd-kit for drag-and-drop interactions:
- `DndContext` wraps the board
- Each `ChessPiece` is a draggable element
- Each `ChessSquare` is a droppable target
- Legal moves are highlighted when a piece is selected or being dragged
