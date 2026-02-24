import { getStartingGameState, getStartingPosition } from './types';

describe('getStartingGameState', () => {
  it('returns white as active color', () => {
    const state = getStartingGameState();
    expect(state.activeColor).toBe('white');
  });

  it('has all castling rights enabled', () => {
    const state = getStartingGameState();
    expect(state.castlingRights).toEqual({ K: true, Q: true, k: true, q: true });
  });

  it('has no en passant square', () => {
    const state = getStartingGameState();
    expect(state.enPassantSquare).toBeNull();
  });

  it('has halfmove clock at 0', () => {
    const state = getStartingGameState();
    expect(state.halfmoveClock).toBe(0);
  });

  it('has fullmove number at 1', () => {
    const state = getStartingGameState();
    expect(state.fullmoveNumber).toBe(1);
  });
});

describe('getStartingPosition', () => {
  const board = getStartingPosition();

  it('has white rooks at a1 and h1', () => {
    expect(board[0]).toEqual({ type: 'rook', color: 'white' });
    expect(board[7]).toEqual({ type: 'rook', color: 'white' });
  });

  it('has white knights at b1 and g1', () => {
    expect(board[1]).toEqual({ type: 'knight', color: 'white' });
    expect(board[6]).toEqual({ type: 'knight', color: 'white' });
  });

  it('has white bishops at c1 and f1', () => {
    expect(board[2]).toEqual({ type: 'bishop', color: 'white' });
    expect(board[5]).toEqual({ type: 'bishop', color: 'white' });
  });

  it('has white queen at d1 and king at e1', () => {
    expect(board[3]).toEqual({ type: 'queen', color: 'white' });
    expect(board[4]).toEqual({ type: 'king', color: 'white' });
  });

  it('has white pawns on rank 2 (indices 8-15)', () => {
    for (let i = 8; i < 16; i++) {
      expect(board[i]).toEqual({ type: 'pawn', color: 'white' });
    }
  });

  it('has black pawns on rank 7 (indices 48-55)', () => {
    for (let i = 48; i < 56; i++) {
      expect(board[i]).toEqual({ type: 'pawn', color: 'black' });
    }
  });

  it('has black back rank pieces in correct positions', () => {
    expect(board[56]).toEqual({ type: 'rook', color: 'black' });
    expect(board[57]).toEqual({ type: 'knight', color: 'black' });
    expect(board[58]).toEqual({ type: 'bishop', color: 'black' });
    expect(board[59]).toEqual({ type: 'queen', color: 'black' });
    expect(board[60]).toEqual({ type: 'king', color: 'black' });
    expect(board[61]).toEqual({ type: 'bishop', color: 'black' });
    expect(board[62]).toEqual({ type: 'knight', color: 'black' });
    expect(board[63]).toEqual({ type: 'rook', color: 'black' });
  });

  it('has empty squares in the middle (indices 16-47)', () => {
    for (let i = 16; i < 48; i++) {
      expect(board[i]).toBeNull();
    }
  });
});
