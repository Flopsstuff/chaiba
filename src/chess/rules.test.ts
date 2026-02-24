import { getLegalMoves, isInCheck, isCheckmate, isStalemate, isSquareAttacked } from './rules';
import type { GameState, Board, Piece, PieceColor } from './types';
import { getStartingGameState } from './types';

// Helper: create an empty board
function emptyBoard(): Board {
  return Array(64).fill(null);
}

// Helper: place a piece on a board
function place(board: Board, index: number, type: Piece['type'], color: PieceColor): void {
  board[index] = { type, color };
}

// Helper: build a minimal GameState from a board
function makeState(
  board: Board,
  activeColor: PieceColor = 'white',
  overrides: Partial<GameState> = {},
): GameState {
  return {
    board,
    activeColor,
    castlingRights: { K: false, Q: false, k: false, q: false },
    enPassantSquare: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    ...overrides,
  };
}

// Square index helper: file + rank * 8
// a1=0, b1=1, ..., h1=7, a2=8, ..., e2=12, ..., a8=56, e8=60, h8=63
function sq(algebraic: string): number {
  const file = algebraic.charCodeAt(0) - 97;
  const rank = parseInt(algebraic[1], 10) - 1;
  return rank * 8 + file;
}

describe('pawn moves', () => {
  it('white pawn on e2 can move to e3 and e4 from starting position', () => {
    const state = getStartingGameState();
    const moves = getLegalMoves(state, sq('e2'));
    expect(moves).toContain(sq('e3'));
    expect(moves).toContain(sq('e4'));
    expect(moves).toHaveLength(2);
  });

  it('black pawn on e7 can move to e6 and e5 when it is black turn', () => {
    const state = getStartingGameState();
    state.activeColor = 'black';
    const moves = getLegalMoves(state, sq('e7'));
    expect(moves).toContain(sq('e6'));
    expect(moves).toContain(sq('e5'));
    expect(moves).toHaveLength(2);
  });
});

describe('knight moves', () => {
  it('white knight on b1 can move to a3 and c3 from starting position', () => {
    const state = getStartingGameState();
    const moves = getLegalMoves(state, sq('b1'));
    expect(moves).toContain(sq('a3'));
    expect(moves).toContain(sq('c3'));
    expect(moves).toHaveLength(2);
  });

  it('white knight on g1 can move to f3 and h3 from starting position', () => {
    const state = getStartingGameState();
    const moves = getLegalMoves(state, sq('g1'));
    expect(moves).toContain(sq('f3'));
    expect(moves).toContain(sq('h3'));
    expect(moves).toHaveLength(2);
  });
});

describe('en passant', () => {
  it('white pawn can capture en passant', () => {
    // White pawn on e5, black pawn on d5, en passant square d6
    const board = emptyBoard();
    place(board, sq('e5'), 'pawn', 'white');
    place(board, sq('d5'), 'pawn', 'black');
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('e8'), 'king', 'black');
    const state = makeState(board, 'white', { enPassantSquare: sq('d6') });

    const moves = getLegalMoves(state, sq('e5'));
    expect(moves).toContain(sq('d6'));
  });

  it('black pawn can capture en passant', () => {
    const board = emptyBoard();
    place(board, sq('d4'), 'pawn', 'black');
    place(board, sq('e4'), 'pawn', 'white');
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('e8'), 'king', 'black');
    const state = makeState(board, 'black', { enPassantSquare: sq('e3') });

    const moves = getLegalMoves(state, sq('d4'));
    expect(moves).toContain(sq('e3'));
  });
});

describe('pawn promotion', () => {
  it('white pawn on 7th rank includes last rank in legal moves', () => {
    const board = emptyBoard();
    place(board, sq('e7'), 'pawn', 'white');
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    const moves = getLegalMoves(state, sq('e7'));
    expect(moves).toContain(sq('e8'));
  });

  it('black pawn on 2nd rank includes first rank in legal moves', () => {
    const board = emptyBoard();
    place(board, sq('d2'), 'pawn', 'black');
    place(board, sq('e8'), 'king', 'black');
    place(board, sq('a1'), 'king', 'white');
    const state = makeState(board, 'black');

    const moves = getLegalMoves(state, sq('d2'));
    expect(moves).toContain(sq('d1'));
  });

  it('pawn promotion capture is included in legal moves', () => {
    const board = emptyBoard();
    place(board, sq('e7'), 'pawn', 'white');
    place(board, sq('d8'), 'rook', 'black');
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    const moves = getLegalMoves(state, sq('e7'));
    expect(moves).toContain(sq('d8'));
    expect(moves).toContain(sq('e8'));
  });
});

describe('castling', () => {
  it('white can castle kingside when path is clear', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('h1'), 'rook', 'white');
    place(board, sq('e8'), 'king', 'black');
    const state = makeState(board, 'white', {
      castlingRights: { K: true, Q: false, k: false, q: false },
    });

    const moves = getLegalMoves(state, sq('e1'));
    expect(moves).toContain(sq('g1')); // g1 = index 6
  });

  it('white can castle queenside when path is clear', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('a1'), 'rook', 'white');
    place(board, sq('e8'), 'king', 'black');
    const state = makeState(board, 'white', {
      castlingRights: { K: false, Q: true, k: false, q: false },
    });

    const moves = getLegalMoves(state, sq('e1'));
    expect(moves).toContain(sq('c1')); // c1 = index 2
  });

  it('cannot castle when a square is attacked', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('h1'), 'rook', 'white');
    place(board, sq('f8'), 'rook', 'black'); // attacks f1
    place(board, sq('e8'), 'king', 'black');
    const state = makeState(board, 'white', {
      castlingRights: { K: true, Q: false, k: false, q: false },
    });

    const moves = getLegalMoves(state, sq('e1'));
    expect(moves).not.toContain(sq('g1'));
  });

  it('cannot castle when in check', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('h1'), 'rook', 'white');
    place(board, sq('e8'), 'rook', 'black'); // gives check on e-file
    const state = makeState(board, 'white', {
      castlingRights: { K: true, Q: false, k: false, q: false },
    });

    const moves = getLegalMoves(state, sq('e1'));
    expect(moves).not.toContain(sq('g1'));
  });
});

describe('check filtering (pins)', () => {
  it('pinned piece cannot move off the pin line', () => {
    // White king on e1, white bishop on e2 (pinned by black rook on e7)
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('e2'), 'bishop', 'white'); // pinned along e-file
    place(board, sq('e7'), 'rook', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    const moves = getLegalMoves(state, sq('e2'));
    // Bishop can't move at all because any move exposes the king
    expect(moves).toHaveLength(0);
  });

  it('pinned rook can move along pin line', () => {
    // White king on e1, white rook on e4 pinned by black rook on e8
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('e4'), 'rook', 'white');
    place(board, sq('e8'), 'rook', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    const moves = getLegalMoves(state, sq('e4'));
    // Rook can move along e-file: e2, e3, e5, e6, e7, e8 (capture)
    expect(moves).toContain(sq('e2'));
    expect(moves).toContain(sq('e3'));
    expect(moves).toContain(sq('e5'));
    expect(moves).toContain(sq('e6'));
    expect(moves).toContain(sq('e7'));
    expect(moves).toContain(sq('e8'));
    // Should not be able to move off the file
    expect(moves).not.toContain(sq('d4'));
    expect(moves).not.toContain(sq('f4'));
  });
});

describe('isInCheck', () => {
  it('returns true when king is under attack', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('e8'), 'rook', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    expect(isInCheck(state, 'white')).toBe(true);
  });

  it('returns false when king is safe', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('d8'), 'rook', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    expect(isInCheck(state, 'white')).toBe(false);
  });

  it('detects knight check', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('f3'), 'knight', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    expect(isInCheck(state, 'white')).toBe(true);
  });

  it('detects pawn check', () => {
    const board = emptyBoard();
    place(board, sq('e4'), 'king', 'white');
    place(board, sq('d5'), 'pawn', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    expect(isInCheck(state, 'white')).toBe(true);
  });
});

describe('isCheckmate', () => {
  it('detects Scholar\'s mate', () => {
    // After 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#
    // FEN: r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4
    const board = emptyBoard();
    // Black pieces
    place(board, sq('a8'), 'rook', 'black');
    place(board, sq('c8'), 'bishop', 'black');
    place(board, sq('d8'), 'queen', 'black');
    place(board, sq('e8'), 'king', 'black');
    place(board, sq('f8'), 'bishop', 'black');
    place(board, sq('h8'), 'rook', 'black');
    place(board, sq('a7'), 'pawn', 'black');
    place(board, sq('b7'), 'pawn', 'black');
    place(board, sq('c7'), 'pawn', 'black');
    place(board, sq('d7'), 'pawn', 'black');
    place(board, sq('g7'), 'pawn', 'black');
    place(board, sq('h7'), 'pawn', 'black');
    place(board, sq('c6'), 'knight', 'black');
    place(board, sq('f6'), 'knight', 'black');
    place(board, sq('e5'), 'pawn', 'black');
    // White pieces
    place(board, sq('f7'), 'queen', 'white'); // Qxf7#
    place(board, sq('c4'), 'bishop', 'white');
    place(board, sq('e4'), 'pawn', 'white');
    place(board, sq('a1'), 'rook', 'white');
    place(board, sq('b1'), 'knight', 'white');
    place(board, sq('c1'), 'bishop', 'white');
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('g1'), 'knight', 'white');
    place(board, sq('h1'), 'rook', 'white');
    place(board, sq('a2'), 'pawn', 'white');
    place(board, sq('b2'), 'pawn', 'white');
    place(board, sq('c2'), 'pawn', 'white');
    place(board, sq('d2'), 'pawn', 'white');
    place(board, sq('f2'), 'pawn', 'white');
    place(board, sq('g2'), 'pawn', 'white');
    place(board, sq('h2'), 'pawn', 'white');

    const state = makeState(board, 'black');

    expect(isInCheck(state, 'black')).toBe(true);
    expect(isCheckmate(state, 'black')).toBe(true);
  });

  it('is not checkmate if king can escape', () => {
    const board = emptyBoard();
    place(board, sq('e1'), 'king', 'white');
    place(board, sq('e8'), 'rook', 'black');
    place(board, sq('a8'), 'king', 'black');
    const state = makeState(board, 'white');

    expect(isInCheck(state, 'white')).toBe(true);
    expect(isCheckmate(state, 'white')).toBe(false);
  });
});

describe('isStalemate', () => {
  it('detects stalemate when king has no legal moves and is not in check', () => {
    // Classic stalemate: black king on a8, white queen on b6, white king on c6 area
    // Simpler: king on h8, white queen on g6, white king on f6 (not giving check)
    // Even simpler known position: Black king a8, White queen b6, White king a6
    // Actually let's use: Black king h8, white queen g6, white king f7 — wait, that's check.

    // Use: Black king a8, White queen c7 (not check, but controls a7, b8, b7), White king b6 (controls a7, a5, b5, c5, c6, c7 — wait c7 has queen)
    // Simplest: King on a8, opponent queen on b6, opponent king on c8? No that's adjacent.

    // King h1, pawn on h2 (own), opponent queen g3 — king can't go anywhere
    // h1 king, h2 own pawn. Queen on g3 controls g1, g2, h3 (but doesn't check h1 directly)
    // Wait — g3 queen: controls g1, g2, h3, h4, f2, f3... but not h1.
    // King on h1: can go to g1 (attacked by Qg3), g2 (attacked by Qg3), h2 is own pawn. So stalemate?
    // Need opponent king too.
    // Black king h8, white king g6, white queen f7.
    // h8 king neighbours: g8 (attacked by Qf7 diagonal), g7 (attacked by Qf7 along rank 7),
    // h7 (attacked by Qf7 along rank 7). No legal moves. Not in check. Stalemate.
    const board = emptyBoard();
    place(board, sq('h8'), 'king', 'black');
    place(board, sq('g6'), 'king', 'white');
    place(board, sq('f7'), 'queen', 'white');
    const state = makeState(board, 'black');

    expect(isInCheck(state, 'black')).toBe(false);
    expect(isStalemate(state, 'black')).toBe(true);
  });

  it('is not stalemate if a move is available', () => {
    const board = emptyBoard();
    place(board, sq('a1'), 'king', 'white');
    place(board, sq('c2'), 'queen', 'black');
    place(board, sq('h8'), 'king', 'black');
    const state = makeState(board, 'white');

    // King on a1 can go to b1 (c2 queen attacks b1? c2 to b1 is diagonal — yes attacked)
    // a1 king: a2 (attacked by queen c2 diag? c2-b1 diag, c2-b3... a2 is on rank 2 file a. queen on c2 attacks along rank 2, so a2 is attacked.)
    // b1: queen c2 attacks diagonally b1. Attacked.
    // b2: queen c2 attacks b2 (adjacent). Attacked.
    // So actually this might be stalemate too... Let me pick a better position.
    // King a1, queen h7, opponent king h8 — king can go to a2, b1, b2.
    const board2 = emptyBoard();
    place(board2, sq('a1'), 'king', 'white');
    place(board2, sq('h7'), 'queen', 'black');
    place(board2, sq('h8'), 'king', 'black');
    const state2 = makeState(board2, 'white');

    expect(isStalemate(state2, 'white')).toBe(false);
  });
});
