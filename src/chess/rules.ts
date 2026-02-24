import type { Board, GameState, Piece, PieceColor } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileOf(index: number): number { return index % 8; }
function rankOf(index: number): number { return Math.floor(index / 8); }
function toIndex(file: number, rank: number): number { return rank * 8 + file; }
function inBounds(f: number, r: number): boolean { return f >= 0 && f < 8 && r >= 0 && r < 8; }

// ---------------------------------------------------------------------------
// Pseudo-legal move generators (no check filtering)
// ---------------------------------------------------------------------------

function getPawnMoves(state: GameState, fromIndex: number, piece: Piece): number[] {
  const { board, enPassantSquare } = state;
  const color = piece.color;
  const result: number[] = [];
  const dir = color === 'white' ? 1 : -1;
  const startRank = color === 'white' ? 1 : 6;
  const file = fileOf(fromIndex);
  const rank = rankOf(fromIndex);

  // One forward
  const oneForward = fromIndex + 8 * dir;
  if (oneForward >= 0 && oneForward < 64 && !board[oneForward]) {
    result.push(oneForward);

    // Two forward from start rank
    if (rank === startRank) {
      const twoForward = fromIndex + 16 * dir;
      if (twoForward >= 0 && twoForward < 64 && !board[twoForward]) {
        result.push(twoForward);
      }
    }
  }

  // Diagonal captures (including en passant)
  for (const df of [-1, 1]) {
    const targetFile = file + df;
    if (targetFile < 0 || targetFile > 7) continue;
    const targetIndex = fromIndex + 8 * dir + df;
    if (targetIndex < 0 || targetIndex >= 64) continue;

    const target = board[targetIndex];
    if (target && target.color !== color) {
      result.push(targetIndex);
    } else if (enPassantSquare != null && targetIndex === enPassantSquare) {
      result.push(targetIndex);
    }
  }

  return result;
}

function getKnightMoves(board: Board, fromIndex: number, color: PieceColor): number[] {
  const file = fileOf(fromIndex);
  const rank = rankOf(fromIndex);
  const deltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const result: number[] = [];
  for (const [dr, df] of deltas) {
    const r = rank + dr;
    const f = file + df;
    if (inBounds(f, r)) {
      const idx = toIndex(f, r);
      const p = board[idx];
      if (!p || p.color !== color) result.push(idx);
    }
  }
  return result;
}

function slideMoves(board: Board, fromIndex: number, color: PieceColor, directions: [number, number][]): number[] {
  const file = fileOf(fromIndex);
  const rank = rankOf(fromIndex);
  const result: number[] = [];
  for (const [df, dr] of directions) {
    let f = file + df;
    let r = rank + dr;
    while (inBounds(f, r)) {
      const idx = toIndex(f, r);
      const p = board[idx];
      if (!p) {
        result.push(idx);
      } else {
        if (p.color !== color) result.push(idx);
        break;
      }
      f += df;
      r += dr;
    }
  }
  return result;
}

function getBishopMoves(board: Board, fromIndex: number, color: PieceColor): number[] {
  return slideMoves(board, fromIndex, color, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
}

function getRookMoves(board: Board, fromIndex: number, color: PieceColor): number[] {
  return slideMoves(board, fromIndex, color, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
}

function getQueenMoves(board: Board, fromIndex: number, color: PieceColor): number[] {
  return [
    ...getBishopMoves(board, fromIndex, color),
    ...getRookMoves(board, fromIndex, color),
  ];
}

function getKingMoves(state: GameState, fromIndex: number, color: PieceColor): number[] {
  const { board, castlingRights } = state;
  const file = fileOf(fromIndex);
  const rank = rankOf(fromIndex);
  const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const result: number[] = [];

  // Normal 1-square moves
  for (const [df, dr] of directions) {
    const f = file + df;
    const r = rank + dr;
    if (inBounds(f, r)) {
      const idx = toIndex(f, r);
      const p = board[idx];
      if (!p || p.color !== color) result.push(idx);
    }
  }

  // Castling
  const opponent: PieceColor = color === 'white' ? 'black' : 'white';
  const homeRank = color === 'white' ? 0 : 7;

  // Only consider castling if king is on its starting square
  if (file === 4 && rank === homeRank) {
    // King not currently in check (prerequisite for castling)
    if (!isSquareAttacked(board, fromIndex, opponent)) {
      // Kingside
      const canKingside = color === 'white' ? castlingRights.K : castlingRights.k;
      if (canKingside) {
        const f1 = toIndex(5, homeRank);
        const g1 = toIndex(6, homeRank);
        if (!board[f1] && !board[g1] &&
            !isSquareAttacked(board, f1, opponent) &&
            !isSquareAttacked(board, g1, opponent)) {
          result.push(g1);
        }
      }

      // Queenside
      const canQueenside = color === 'white' ? castlingRights.Q : castlingRights.q;
      if (canQueenside) {
        const d1 = toIndex(3, homeRank);
        const c1 = toIndex(2, homeRank);
        const b1 = toIndex(1, homeRank);
        if (!board[d1] && !board[c1] && !board[b1] &&
            !isSquareAttacked(board, d1, opponent) &&
            !isSquareAttacked(board, c1, opponent)) {
          result.push(c1);
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Attack detection
// ---------------------------------------------------------------------------

export function isSquareAttacked(board: Board, squareIndex: number, byColor: PieceColor): boolean {
  const file = fileOf(squareIndex);
  const rank = rankOf(squareIndex);

  // Knight attacks
  const knightDeltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const [dr, df] of knightDeltas) {
    const r = rank + dr;
    const f = file + df;
    if (inBounds(f, r)) {
      const p = board[toIndex(f, r)];
      if (p && p.color === byColor && p.type === 'knight') return true;
    }
  }

  // Pawn attacks
  const pawnDir = byColor === 'white' ? 1 : -1;
  // A pawn of byColor attacks squareIndex from one rank "behind" (from the pawn's perspective)
  const pawnRank = rank - pawnDir;
  for (const df of [-1, 1]) {
    const pf = file + df;
    if (inBounds(pf, pawnRank)) {
      const p = board[toIndex(pf, pawnRank)];
      if (p && p.color === byColor && p.type === 'pawn') return true;
    }
  }

  // King adjacency
  const kingDeltas = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (const [df, dr] of kingDeltas) {
    const f = file + df;
    const r = rank + dr;
    if (inBounds(f, r)) {
      const p = board[toIndex(f, r)];
      if (p && p.color === byColor && p.type === 'king') return true;
    }
  }

  // Sliding attacks: bishop/queen on diagonals, rook/queen on straights
  const diagonals: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [df, dr] of diagonals) {
    let f = file + df;
    let r = rank + dr;
    while (inBounds(f, r)) {
      const p = board[toIndex(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'bishop' || p.type === 'queen')) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  const straights: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [df, dr] of straights) {
    let f = file + df;
    let r = rank + dr;
    while (inBounds(f, r)) {
      const p = board[toIndex(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'rook' || p.type === 'queen')) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Check / Checkmate / Stalemate
// ---------------------------------------------------------------------------

export function isInCheck(state: GameState, color: PieceColor): boolean {
  const { board } = state;
  const opponent: PieceColor = color === 'white' ? 'black' : 'white';
  // Find king
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type === 'king' && p.color === color) {
      return isSquareAttacked(board, i, opponent);
    }
  }
  return false;
}

function hasAnyLegalMove(state: GameState, color: PieceColor): boolean {
  const { board } = state;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color) {
      if (getLegalMoves(state, i).length > 0) return true;
    }
  }
  return false;
}

export function isCheckmate(state: GameState, color: PieceColor): boolean {
  return isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

export function isStalemate(state: GameState, color: PieceColor): boolean {
  return !isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

// ---------------------------------------------------------------------------
// Legal move generation (with check filtering)
// ---------------------------------------------------------------------------

function getPseudoLegalMoves(state: GameState, fromIndex: number): number[] {
  const piece = state.board[fromIndex];
  if (!piece) return [];

  switch (piece.type) {
    case 'pawn':
      return getPawnMoves(state, fromIndex, piece);
    case 'knight':
      return getKnightMoves(state.board, fromIndex, piece.color);
    case 'bishop':
      return getBishopMoves(state.board, fromIndex, piece.color);
    case 'rook':
      return getRookMoves(state.board, fromIndex, piece.color);
    case 'queen':
      return getQueenMoves(state.board, fromIndex, piece.color);
    case 'king':
      return getKingMoves(state, fromIndex, piece.color);
  }
}

export function getLegalMoves(state: GameState, fromIndex: number): number[] {
  const piece = state.board[fromIndex];
  if (!piece) return [];

  const color = piece.color;
  const opponent: PieceColor = color === 'white' ? 'black' : 'white';
  const pseudoMoves = getPseudoLegalMoves(state, fromIndex);

  return pseudoMoves.filter((toIndex) => {
    // Simulate the move on a board copy
    const boardCopy = [...state.board];
    boardCopy[toIndex] = boardCopy[fromIndex];
    boardCopy[fromIndex] = null;

    // Handle en passant capture: remove captured pawn
    if (piece.type === 'pawn' && toIndex === state.enPassantSquare) {
      const capturedPawnIndex = toIndex + (color === 'white' ? -8 : 8);
      boardCopy[capturedPawnIndex] = null;
    }

    // Handle castling: move the rook too
    if (piece.type === 'king') {
      const fileDiff = fileOf(toIndex) - fileOf(fromIndex);
      if (Math.abs(fileDiff) === 2) {
        if (fileDiff === 2) {
          // Kingside
          boardCopy[toIndex - 1] = boardCopy[toIndex + 1]; // rook from h-file to f-file
          boardCopy[toIndex + 1] = null;
        } else {
          // Queenside
          boardCopy[toIndex + 1] = boardCopy[toIndex - 2]; // rook from a-file to d-file
          boardCopy[toIndex - 2] = null;
        }
      }
    }

    // Find own king position after move
    let kingIndex = -1;
    for (let i = 0; i < 64; i++) {
      const p = boardCopy[i];
      if (p && p.type === 'king' && p.color === color) {
        kingIndex = i;
        break;
      }
    }

    // King must not be in check after the move
    return kingIndex >= 0 && !isSquareAttacked(boardCopy, kingIndex, opponent);
  });
}
