## Why

Arena is the core playing space of CHAIBA (Chess AI Battle Arena). Currently it's empty. To enable chess gameplay—whether human vs human or AI battles—we need an interactive chess board with pieces, move validation, and visual feedback for valid moves.

## What Changes

- Add chess board 8×8 in Arena component, white pieces at bottom (standard orientation)
- Add drag-and-drop for moving pieces (initially any piece can be dragged to any square—order/restrictions TBD by rules)
- Add chess rules validator component to compute valid moves per piece
- Highlight cells with valid moves when a piece is selected or dragged

## Capabilities

### New Capabilities

- `arena-chess-board`: 8×8 board, starting position, white at bottom, squares and coordinates
- `chess-piece-drag-drop`: Drag-and-drop piece movement; piece state updates on drop
- `chess-rules-validator`: Pure logic to compute legal moves per piece type given board state
- `valid-moves-highlight`: Visual highlight of valid destination squares when piece is selected/dragged

### Modified Capabilities

- _(none)_

## Impact

- `src/components/panels/Arena.tsx` — integrate board and piece components
- New components: `ChessBoard`, `ChessPiece`, `ChessRulesValidator` (or similar)
- New dependencies: possibly a DnD library (e.g. `@dnd-kit/core`) or native HTML5 DnD
- Arena CSS for board layout, piece styling, highlight styles
