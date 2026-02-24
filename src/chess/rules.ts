import type { Board, Piece } from './types';

export function getLegalMoves(board: Board, fromIndex: number): number[] {
  const piece = board[fromIndex];
  if (!piece) return [];

  const fromFile = fromIndex % 8;
  const fromRank = Math.floor(fromIndex / 8);

  switch (piece.type) {
    case 'pawn':
      return getPawnMoves(board, fromIndex, fromFile, fromRank, piece.color);
    case 'knight':
      return getKnightMoves(board, fromFile, fromRank, piece.color);
    case 'bishop':
      return getBishopMoves(board, fromFile, fromRank, piece.color);
    case 'rook':
      return getRookMoves(board, fromFile, fromRank, piece.color);
    case 'queen':
      return [...getBishopMoves(board, fromFile, fromRank, piece.color), ...getRookMoves(board, fromFile, fromRank, piece.color)];
    case 'king':
      return getKingMoves(board, fromFile, fromRank, piece.color);
  }
}

function getPawnMoves(board: Board, fromIndex: number, file: number, rank: number, color: Piece['color']): number[] {
  const result: number[] = [];
  const dir = color === 'white' ? 1 : -1;
  const startRank = color === 'white' ? 1 : 6;

  // One forward
  const oneForward = fromIndex + 8 * dir;
  if (oneForward >= 0 && oneForward < 64 && !board[oneForward]) {
    result.push(oneForward);
  }

  // Two forward from start
  if (rank === startRank) {
    const twoForward = fromIndex + 16 * dir;
    if (twoForward >= 0 && twoForward < 64 && !board[twoForward] && !board[oneForward]) {
      result.push(twoForward);
    }
  }

  // Captures diagonal
  for (const df of [-1, 1]) {
    const targetFile = file + df;
    const targetIndex = fromIndex + 8 * dir + df;
    if (targetFile >= 0 && targetFile < 8 && targetIndex >= 0 && targetIndex < 64) {
      const target = board[targetIndex];
      if (target && target.color !== color) result.push(targetIndex);
    }
  }
  return result;
}

function getKnightMoves(board: Board, file: number, rank: number, color: Piece['color']): number[] {
  const deltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const result: number[] = [];
  for (const [dr, df] of deltas) {
    const r = rank + dr;
    const f = file + df;
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const idx = r * 8 + f;
      const p = board[idx];
      if (!p || p.color !== color) result.push(idx);
    }
  }
  return result;
}

function slideMoves(board: Board, file: number, rank: number, color: Piece['color'], directions: [number, number][]): number[] {
  const result: number[] = [];
  for (const [df, dr] of directions) {
    let f = file + df;
    let r = rank + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const idx = r * 8 + f;
      const p = board[idx];
      if (!p) result.push(idx);
      else {
        if (p.color !== color) result.push(idx);
        break;
      }
      f += df;
      r += dr;
    }
  }
  return result;
}

function getBishopMoves(board: Board, file: number, rank: number, color: Piece['color']): number[] {
  return slideMoves(board, file, rank, color, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
}

function getRookMoves(board: Board, file: number, rank: number, color: Piece['color']): number[] {
  return slideMoves(board, file, rank, color, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
}

function getKingMoves(board: Board, file: number, rank: number, color: Piece['color']): number[] {
  const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const result: number[] = [];
  for (const [df, dr] of directions) {
    const f = file + df;
    const r = rank + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const idx = r * 8 + f;
      const p = board[idx];
      if (!p || p.color !== color) result.push(idx);
    }
  }
  return result;
}
