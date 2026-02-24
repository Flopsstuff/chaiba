## Context

Arena component (`src/components/panels/Arena.tsx`) is currently a placeholder. CHAIBA uses React 19, TypeScript, CRA. No DnD or chess libraries yet. We need a chess board with drag-drop, rules validation, and valid-move highlighting.

## Goals / Non-Goals

**Goals:**
- 8×8 board, white at bottom; standard starting position
- Drag-and-drop piece movement; state updates on drop
- Pure rules validator (getLegalMoves(board, square))
- Highlight valid destination squares on piece select/drag

**Non-Goals:**
- Turn enforcement (white/black order)—pieces movable in any order for now
- Check/checkmate detection
- Castling, en passant, promotion logic
- Persistence, undo/redo

## Decisions

### Board representation
- **Choice**: 8×8 array (or flat 64) with piece objects `{ type, color }` per square; null = empty.
- **Why**: Simple, index = file + rank*8; easy to map UI ↔ state.
- **Alternative**: FEN string—deferred until we need serialization.

### DnD library
- **Choice**: `@dnd-kit/core` + `@dnd-kit/sortable` (or simpler `@dnd-kit/core` only).
- **Why**: Modern, accessible, React-friendly; good with grid.
- **Alternative**: HTML5 DnD (no deps, but more boilerplate and edge cases).

### Rules validator location
- **Choice**: Pure module `src/chess/rules.ts` (or `src/lib/chess-rules.ts`) with functions like `getLegalMoves(board, fromSquare)`.
- **Why**: No React coupling; reusable for AI; easy to test.
- **Alternative**: In-component logic—rejected for testability.

### Piece assets
- **Choice**: Unicode symbols (♔♕♖♗♘♙ / ♚♛♜♝♞♟) or inline SVG/CSS.
- **Why**: No image dependencies; fast.
- **Alternative**: Image sprites—overkill for MVP.

## Risks / Trade-offs

- **[Risk]** @dnd-kit adds ~20KB; **[Mitigation]** Tree-shake; acceptable for SPA.
- **[Risk]** Rules bugs (e.g. pawn first move, knight jumps); **[Mitigation]** Unit tests on `getLegalMoves` for each piece type.
- **[Risk]** Over-highlighting (e.g. pinned pieces moving into check); **[Mitigation]** Phase 1: only pseudo-legal moves; filter checks in later iteration.

## Migration Plan

1. Add `@dnd-kit/core` (and `@dnd-kit/utilities` if needed).
2. Create `ChessBoard`, `ChessSquare`, `ChessPiece` components; integrate into Arena.
3. Add `rules.ts`; wire `getLegalMoves` into highlight logic.
4. No migration/rollback—new feature only.

## Open Questions

- Exact folder structure: `src/chess/` vs `src/components/chess/` vs `src/lib/chess/`?
- Highlight style: border, background, or both?
