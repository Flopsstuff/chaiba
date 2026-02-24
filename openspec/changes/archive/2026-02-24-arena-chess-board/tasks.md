## 1. Setup

- [x] 1.1 Add @dnd-kit/core (and @dnd-kit/utilities if needed) to package.json
- [x] 1.2 Define board types: Piece (type, color), Square index, Board (Piece | null)[]
- [x] 1.3 Add getStartingPosition(): Board returning standard initial setup

## 2. Chess rules module

- [x] 2.1 Create src/chess/rules.ts (or src/lib/chess-rules.ts)
- [x] 2.2 Implement getLegalMoves(board: Board, fromIndex: number): number[]
- [x] 2.3 Implement move logic for pawn (including first-move double step)
- [x] 2.4 Implement move logic for knight
- [x] 2.5 Implement move logic for bishop (diagonals, blocking)
- [x] 2.6 Implement move logic for rook (ranks/files, blocking)
- [x] 2.7 Implement move logic for queen (bishop + rook)
- [x] 2.8 Implement move logic for king (one square any direction)

## 3. Board components (static)

- [x] 3.1 Create ChessSquare component (receives index, piece|null, isHighlight)
- [x] 3.2 Create ChessPiece component (renders Unicode symbol by type/color)
- [x] 3.3 Create ChessBoard component: 8×8 grid, white at bottom, alternating colors
- [x] 3.4 Add CSS for board layout, square colors, piece styling

## 4. State and DnD

- [x] 4.1 Add board state (useState) in ChessBoard or Arena
- [x] 4.2 Wrap board in DndContext; make pieces draggable
- [x] 4.3 Implement drop handler: update board state on valid drop
- [x] 4.4 Track selected/dragged piece; show during drag

## 5. Valid moves highlight

- [x] 5.1 On piece select or drag start, call getLegalMoves(board, fromIndex)
- [x] 5.2 Pass valid indices to ChessSquare; apply highlight style
- [x] 5.3 Clear highlights on drop or click away

## 6. Arena integration

- [x] 6.1 Replace Arena TODO with ChessBoard
- [x] 6.2 Verify layout and styling in Arena panel
