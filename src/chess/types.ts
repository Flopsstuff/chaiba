// Board: flat 64, index = file + rank * 8. rank 0 = bottom (white), 7 = top (black)
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export type Board = (Piece | null)[];

export function getStartingPosition(): Board {
  const board: Board = Array(64).fill(null);
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

  // White pieces (rank 0, 1) - bottom
  for (let f = 0; f < 8; f++) {
    board[f] = { type: backRank[f], color: 'white' };
    board[8 + f] = { type: 'pawn', color: 'white' };
  }
  // Black pieces (rank 6, 7) - top
  for (let f = 0; f < 8; f++) {
    board[48 + f] = { type: 'pawn', color: 'black' };
    board[56 + f] = { type: backRank[f], color: 'black' };
  }
  return board;
}
