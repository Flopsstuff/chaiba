import { ChessEngine } from './engine';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('ChessEngine constructor', () => {
  it('creates starting position', () => {
    const engine = new ChessEngine();
    expect(engine.getFEN()).toBe(STARTING_FEN);
  });
});

describe('reset', () => {
  it('restores starting position after moves have been played', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.reset();
    expect(engine.getFEN()).toBe(STARTING_FEN);
    expect(engine.getSAN()).toEqual([]);
  });

  it('generates valid Chess960 position with reset(true)', () => {
    const engine = new ChessEngine();
    engine.reset(true);
    const state = engine.getState();
    const board = state.board;

    // Collect white back rank (indices 0-7)
    const backRank = [];
    for (let i = 0; i < 8; i++) {
      const p = board[i];
      expect(p).not.toBeNull();
      expect(p!.color).toBe('white');
      backRank.push(p!.type);
    }

    // Black back rank mirrors white
    for (let i = 0; i < 8; i++) {
      expect(board[56 + i]!.type).toBe(backRank[i]);
      expect(board[56 + i]!.color).toBe('black');
    }

    // King must be between the two rooks
    const kingFile = backRank.indexOf('king');
    const firstRook = backRank.indexOf('rook');
    const lastRook = backRank.lastIndexOf('rook');
    expect(kingFile).toBeGreaterThan(firstRook);
    expect(kingFile).toBeLessThan(lastRook);

    // Bishops must be on opposite colored squares
    const bishopFiles: number[] = [];
    backRank.forEach((piece, i) => {
      if (piece === 'bishop') bishopFiles.push(i);
    });
    expect(bishopFiles).toHaveLength(2);
    expect(bishopFiles[0] % 2).not.toBe(bishopFiles[1] % 2);

    // Pawns on rank 2 and 7
    for (let i = 8; i < 16; i++) {
      expect(board[i]).toEqual({ type: 'pawn', color: 'white' });
    }
    for (let i = 48; i < 56; i++) {
      expect(board[i]).toEqual({ type: 'pawn', color: 'black' });
    }
  });
});

describe('getFEN / setFEN', () => {
  it('round-trips a custom FEN', () => {
    const engine = new ChessEngine();
    const customFen =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    engine.setFEN(customFen);
    expect(engine.getFEN()).toBe(customFen);
  });

  it('round-trips a mid-game FEN', () => {
    const engine = new ChessEngine();
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    engine.setFEN(fen);
    expect(engine.getFEN()).toBe(fen);
  });

  it('throws on invalid FEN (wrong number of fields)', () => {
    const engine = new ChessEngine();
    expect(() => engine.setFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')).toThrow(
      /expected 6/i,
    );
  });

  it('throws on invalid FEN (bad piece placement)', () => {
    const engine = new ChessEngine();
    expect(() =>
      engine.setFEN('rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toThrow(/expected 8 ranks/i);
  });

  it('throws on invalid FEN (bad active color)', () => {
    const engine = new ChessEngine();
    expect(() =>
      engine.setFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'),
    ).toThrow(/active color/i);
  });
});

describe('moveUCI', () => {
  it('e2e4 from start succeeds and updates FEN', () => {
    const engine = new ChessEngine();
    const result = engine.moveUCI('e2e4');
    expect(result).toEqual({ success: true });

    const fen = engine.getFEN();
    expect(fen).toContain('4P3'); // pawn on e4 in rank 4
    expect(fen).toMatch(/\sb\s/); // black to move
  });

  it('e2e5 from start fails (illegal move)', () => {
    const engine = new ChessEngine();
    const result = engine.moveUCI('e2e5');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not legal/i);
    }
  });

  it('fails when moving opponent piece (wrong turn)', () => {
    const engine = new ChessEngine();
    const result = engine.moveUCI('e7e5'); // black piece, but white's turn
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/white.*turn/i);
    }
  });

  it('fails on invalid UCI format', () => {
    const engine = new ChessEngine();
    const result = engine.moveUCI('xyz');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/invalid uci format/i);
    }
  });

  it('fails on another invalid format', () => {
    const engine = new ChessEngine();
    const result = engine.moveUCI('e2');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/invalid uci format/i);
    }
  });

  it('castling kingside via e1g1', () => {
    const engine = new ChessEngine();
    // Play moves to clear kingside: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.moveUCI('g1f3');
    engine.moveUCI('b8c6');
    engine.moveUCI('f1c4');
    engine.moveUCI('f8c5');
    const result = engine.moveUCI('e1g1'); // castle kingside
    expect(result).toEqual({ success: true });

    const state = engine.getState();
    // King should be on g1 (index 6), rook on f1 (index 5)
    expect(state.board[6]).toEqual({ type: 'king', color: 'white' });
    expect(state.board[5]).toEqual({ type: 'rook', color: 'white' });
    // e1 and h1 should be empty
    expect(state.board[4]).toBeNull();
    expect(state.board[7]).toBeNull();
    // White castling rights gone
    expect(state.castlingRights.K).toBe(false);
    expect(state.castlingRights.Q).toBe(false);
  });
});

describe('move history', () => {
  it('history grows with each move', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.moveUCI('g1f3');
    expect(engine.getHistory()).toHaveLength(3);
  });
});

describe('state updates after move', () => {
  it('sets en passant square after double pawn push', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    const state = engine.getState();
    // e3 = file 4, rank 2 = index 20
    expect(state.enPassantSquare).toBe(20);
  });

  it('clears en passant square after non-pawn move', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.moveUCI('g1f3');
    const state = engine.getState();
    expect(state.enPassantSquare).toBeNull();
  });

  it('increments fullmove number after black moves', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    expect(engine.getState().fullmoveNumber).toBe(1);
    engine.moveUCI('e7e5');
    expect(engine.getState().fullmoveNumber).toBe(2);
  });

  it('increments halfmove clock on non-pawn non-capture move', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4'); // pawn move, clock = 0
    engine.moveUCI('e7e5'); // pawn move, clock = 0
    engine.moveUCI('g1f3'); // knight move, clock = 1
    expect(engine.getState().halfmoveClock).toBe(1);
  });

  it('resets halfmove clock on pawn move', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.moveUCI('g1f3'); // clock = 1
    engine.moveUCI('d7d5'); // pawn move, clock = 0
    expect(engine.getState().halfmoveClock).toBe(0);
  });
});

describe('promotion via moveUCI', () => {
  it('promotes pawn to queen with e7e8q', () => {
    const engine = new ChessEngine();
    // Kings far apart so no check issues
    engine.setFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    const result = engine.moveUCI('e7e8q');
    expect(result).toEqual({ success: true });
    const state = engine.getState();
    expect(state.board[60]).toEqual({ type: 'queen', color: 'white' });
    expect(state.board[52]).toBeNull();
  });

  it('promotes pawn to knight with e7e8n', () => {
    const engine = new ChessEngine();
    engine.setFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    const result = engine.moveUCI('e7e8n');
    expect(result).toEqual({ success: true });
    const state = engine.getState();
    expect(state.board[60]).toEqual({ type: 'knight', color: 'white' });
  });

  it('promotes pawn with capture', () => {
    const engine = new ChessEngine();
    engine.setFEN('3r4/4P3/8/8/8/8/8/K6k w - - 0 1');
    const result = engine.moveUCI('e7d8q');
    expect(result).toEqual({ success: true });
    const state = engine.getState();
    expect(state.board[59]).toEqual({ type: 'queen', color: 'white' });
  });
});

describe('getSAN', () => {
  it('returns correct SAN for opening moves e4, e5, Nf3', () => {
    const engine = new ChessEngine();
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.moveUCI('g1f3');
    expect(engine.getSAN()).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('returns capture notation for pawn captures', () => {
    const engine = new ChessEngine();
    // 1.e4 d5 2.exd5
    engine.moveUCI('e2e4');
    engine.moveUCI('d7d5');
    engine.moveUCI('e4d5');
    const san = engine.getSAN();
    expect(san[2]).toBe('exd5');
  });

  it('returns O-O for kingside castling', () => {
    const engine = new ChessEngine();
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O
    engine.moveUCI('e2e4');
    engine.moveUCI('e7e5');
    engine.moveUCI('g1f3');
    engine.moveUCI('b8c6');
    engine.moveUCI('f1c4');
    engine.moveUCI('f8c5');
    engine.moveUCI('e1g1');
    const san = engine.getSAN();
    expect(san[6]).toBe('O-O');
  });

  it('returns O-O-O for queenside castling', () => {
    const engine = new ChessEngine();
    // 1.d4 d5 2.Nc3 Nc6 3.Bf4 Bf5 4.Qd2 Qd7 5.O-O-O
    engine.moveUCI('d2d4');
    engine.moveUCI('d7d5');
    engine.moveUCI('b1c3');
    engine.moveUCI('b8c6');
    engine.moveUCI('c1f4');
    engine.moveUCI('c8f5');
    engine.moveUCI('d1d2');
    engine.moveUCI('d8d7');
    engine.moveUCI('e1c1');
    const san = engine.getSAN();
    expect(san[8]).toBe('O-O-O');
  });

  it('appends + for check', () => {
    const engine = new ChessEngine();
    // Scholar's mate up to check: 1.e4 e5 2.Qh5 (attacks f7 but not check)
    // Let's do: 1.e4 e5 2.Bc4 Nc6 3.Qh5 (threatens f7) ... actually Qh5 doesn't give check.
    // Simple check: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# — that's mate, not just check.
    // 1.e4 f5 2.Qh5+ — that's check to the king on e8
    engine.moveUCI('e2e4');
    engine.moveUCI('f7f5');
    engine.moveUCI('d1h5');
    const san = engine.getSAN();
    expect(san[2]).toBe('Qh5+');
  });

  it('appends # for checkmate', () => {
    const engine = new ChessEngine();
    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    engine.moveUCI('f2f3');
    engine.moveUCI('e7e5');
    engine.moveUCI('g2g4');
    engine.moveUCI('d8h4');
    const san = engine.getSAN();
    expect(san[3]).toBe('Qh4#');
  });

  it('returns promotion notation e8=Q', () => {
    const engine = new ChessEngine();
    engine.setFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    engine.moveUCI('e7e8q');
    const san = engine.getSAN();
    expect(san[0]).toBe('e8=Q');
  });

  it('returns promotion capture notation exd8=Q', () => {
    const engine = new ChessEngine();
    engine.setFEN('3r4/4P3/8/8/8/8/8/K6k w - - 0 1');
    engine.moveUCI('e7d8q');
    const san = engine.getSAN();
    expect(san[0]).toBe('exd8=Q');
  });

  it('disambiguates when two knights can reach the same square', () => {
    const engine = new ChessEngine();
    // Two white knights that can both reach e4: Nc3 and Nf2 can both go to e4? No.
    // Nc3 goes to e4: yes (c3 -> e4 is L-shape). Ng5 goes to e4: yes (g5 -> e4? no).
    // Nc3 and Nd2 can both go to e4? Nd2 -> e4 is not L. Let's use Nc3 and Ng3 -> both reach e4?
    // Nc3: c3->e4 (2 right, 1 up) = yes. Ng3: g3->e4 (2 left, 1 up) = yes? g3 is file 6, rank 2. e4 is file 4, rank 3. diff: -2, +1. Yes L-shape.
    // Position: White Nc3, Ng3, King e1. Black king e8.
    engine.setFEN('4k3/8/8/8/8/2N3N1/8/4K3 w - - 0 1');
    // Move knight from c3 to e4
    engine.moveUCI('c3e4');
    const san = engine.getSAN();
    expect(san[0]).toBe('Nce4');
  });

  it('disambiguates by rank when knights share a file', () => {
    const engine = new ChessEngine();
    // Two white knights on c3 and c5, both can reach e4.
    // c3->e4: file diff 2, rank diff 1 = L-shape yes. c5->e4: file diff 2, rank diff -1 = L-shape yes.
    engine.setFEN('4k3/8/8/2N5/8/2N5/8/4K3 w - - 0 1');
    engine.moveUCI('c3e4');
    const san = engine.getSAN();
    expect(san[0]).toBe('N3e4');
  });
});

describe('moveSAN', () => {
  it('plays simple pawn moves', () => {
    const engine = new ChessEngine();
    expect(engine.moveSAN('e4')).toEqual({ success: true });
    expect(engine.moveSAN('e5')).toEqual({ success: true });
    expect(engine.getFEN()).toContain('4p3');
  });

  it('plays piece moves with prefix', () => {
    const engine = new ChessEngine();
    engine.moveSAN('e4');
    engine.moveSAN('e5');
    expect(engine.moveSAN('Nf3')).toEqual({ success: true });
    expect(engine.getSAN()).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('plays pawn captures', () => {
    const engine = new ChessEngine();
    engine.moveSAN('e4');
    engine.moveSAN('d5');
    expect(engine.moveSAN('exd5')).toEqual({ success: true });
    expect(engine.getSAN()[2]).toBe('exd5');
  });

  it('plays kingside castling O-O', () => {
    const engine = new ChessEngine();
    engine.moveSAN('e4');
    engine.moveSAN('e5');
    engine.moveSAN('Nf3');
    engine.moveSAN('Nc6');
    engine.moveSAN('Bc4');
    engine.moveSAN('Bc5');
    expect(engine.moveSAN('O-O')).toEqual({ success: true });
    const state = engine.getState();
    expect(state.board[6]).toEqual({ type: 'king', color: 'white' });
    expect(state.board[5]).toEqual({ type: 'rook', color: 'white' });
  });

  it('plays queenside castling O-O-O', () => {
    const engine = new ChessEngine();
    engine.moveSAN('d4');
    engine.moveSAN('d5');
    engine.moveSAN('Nc3');
    engine.moveSAN('Nc6');
    engine.moveSAN('Bf4');
    engine.moveSAN('Bf5');
    engine.moveSAN('Qd2');
    engine.moveSAN('Qd7');
    expect(engine.moveSAN('O-O-O')).toEqual({ success: true });
    const state = engine.getState();
    expect(state.board[2]).toEqual({ type: 'king', color: 'white' });
    expect(state.board[3]).toEqual({ type: 'rook', color: 'white' });
  });

  it('handles castling with 0-0 notation', () => {
    const engine = new ChessEngine();
    engine.moveSAN('e4');
    engine.moveSAN('e5');
    engine.moveSAN('Nf3');
    engine.moveSAN('Nc6');
    engine.moveSAN('Bc4');
    engine.moveSAN('Bc5');
    expect(engine.moveSAN('0-0')).toEqual({ success: true });
  });

  it('plays promotion', () => {
    const engine = new ChessEngine();
    engine.setFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(engine.moveSAN('e8=Q')).toEqual({ success: true });
    expect(engine.getState().board[60]).toEqual({ type: 'queen', color: 'white' });
  });

  it('plays promotion without = sign (e.g. e8Q)', () => {
    const engine = new ChessEngine();
    engine.setFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(engine.moveSAN('e8Q')).toEqual({ success: true });
    expect(engine.getState().board[60]).toEqual({ type: 'queen', color: 'white' });
  });

  it('plays promotion with capture without = sign (e.g. exd8Q)', () => {
    const engine = new ChessEngine();
    engine.setFEN('3r4/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(engine.moveSAN('exd8Q')).toEqual({ success: true });
    expect(engine.getState().board[59]).toEqual({ type: 'queen', color: 'white' });
  });

  it('plays promotion with capture', () => {
    const engine = new ChessEngine();
    engine.setFEN('3r4/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(engine.moveSAN('exd8=Q')).toEqual({ success: true });
    expect(engine.getState().board[59]).toEqual({ type: 'queen', color: 'white' });
  });

  it('handles disambiguation by file', () => {
    const engine = new ChessEngine();
    engine.setFEN('4k3/8/8/8/8/2N3N1/8/4K3 w - - 0 1');
    expect(engine.moveSAN('Nce4')).toEqual({ success: true });
  });

  it('handles disambiguation by rank', () => {
    const engine = new ChessEngine();
    engine.setFEN('4k3/8/8/2N5/8/2N5/8/4K3 w - - 0 1');
    expect(engine.moveSAN('N3e4')).toEqual({ success: true });
  });

  it('strips + and # suffixes', () => {
    const engine = new ChessEngine();
    engine.moveSAN('e4');
    engine.moveSAN('f5');
    expect(engine.moveSAN('Qh5+')).toEqual({ success: true });
  });

  it('returns error for invalid SAN', () => {
    const engine = new ChessEngine();
    const result = engine.moveSAN('Zz9');
    expect(result.success).toBe(false);
  });

  it('returns error when no piece matches', () => {
    const engine = new ChessEngine();
    const result = engine.moveSAN('Nf6');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/no legal move/i);
    }
  });

  it('round-trips: moveSAN produces same result as moveUCI', () => {
    const e1 = new ChessEngine();
    const e2 = new ChessEngine();
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'];
    for (const m of moves) {
      e1.moveSAN(m);
    }
    e2.moveUCI('e2e4');
    e2.moveUCI('e7e5');
    e2.moveUCI('g1f3');
    e2.moveUCI('b8c6');
    e2.moveUCI('f1b5');
    e2.moveUCI('a7a6');
    e2.moveUCI('b5a4');
    e2.moveUCI('g8f6');
    expect(e1.getFEN()).toBe(e2.getFEN());
    expect(e1.getSAN()).toEqual(e2.getSAN());
  });
});
