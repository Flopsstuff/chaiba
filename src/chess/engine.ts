import type {
  PieceType,
  PieceColor,
  Piece,
  Board,
  CastlingRights,
  GameState,
} from './types';
import { getStartingGameState } from './types';
import {
  getLegalMoves,
  isInCheck,
  isCheckmate,
} from './rules';

interface MoveRecord {
  piece: PieceType;
  color: PieceColor;
  from: number;
  to: number;
  captured: PieceType | null;
  promotion: PieceType | null;
  isCastleKingside: boolean;
  isCastleQueenside: boolean;
  stateBefore: GameState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function squareToAlgebraic(index: number): string {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return String.fromCharCode(97 + file) + (rank + 1);
}

function algebraicToSquare(s: string): number {
  const file = s.charCodeAt(0) - 97;
  const rank = parseInt(s[1], 10) - 1;
  return rank * 8 + file;
}

function pieceToFenChar(piece: Piece): string {
  const map: Record<PieceType, string> = {
    king: 'k',
    queen: 'q',
    rook: 'r',
    bishop: 'b',
    knight: 'n',
    pawn: 'p',
  };
  const ch = map[piece.type];
  return piece.color === 'white' ? ch.toUpperCase() : ch;
}

function fenCharToPiece(ch: string): Piece {
  const map: Record<string, PieceType> = {
    k: 'king',
    q: 'queen',
    r: 'rook',
    b: 'bishop',
    n: 'knight',
    p: 'pawn',
  };
  const lower = ch.toLowerCase();
  if (!(lower in map)) {
    throw new Error(`Invalid FEN piece character: ${ch}`);
  }
  return {
    type: map[lower],
    color: ch === ch.toUpperCase() ? 'white' : 'black',
  };
}

function cloneBoard(board: Board): Board {
  return board.map((p) => (p ? { ...p } : null));
}

function cloneState(state: GameState): GameState {
  return {
    board: cloneBoard(state.board),
    activeColor: state.activeColor,
    castlingRights: { ...state.castlingRights },
    enPassantSquare: state.enPassantSquare,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
  };
}

function pieceTypeSanPrefix(type: PieceType): string {
  const map: Record<PieceType, string> = {
    king: 'K',
    queen: 'Q',
    rook: 'R',
    bishop: 'B',
    knight: 'N',
    pawn: '',
  };
  return map[type];
}

function promotionCharToType(ch: string): PieceType | null {
  const map: Record<string, PieceType> = {
    q: 'queen',
    r: 'rook',
    b: 'bishop',
    n: 'knight',
  };
  return map[ch.toLowerCase()] ?? null;
}

function sanPrefixToPieceType(ch: string): PieceType {
  const map: Record<string, PieceType> = {
    K: 'king',
    Q: 'queen',
    R: 'rook',
    B: 'bishop',
    N: 'knight',
  };
  return map[ch];
}

function promotionTypeToSan(type: PieceType): string {
  const map: Record<PieceType, string> = {
    queen: 'Q',
    rook: 'R',
    bishop: 'B',
    knight: 'N',
    king: '',
    pawn: '',
  };
  return map[type];
}

/**
 * Apply a move on a cloned state and return the new state.
 * Used by getSAN to determine check / checkmate after each move.
 */
function applyMoveToState(
  state: GameState,
  from: number,
  to: number,
  promotion: PieceType | null,
): GameState {
  const s = cloneState(state);
  const piece = s.board[from]!;
  const captured = s.board[to];

  // En passant capture
  if (piece.type === 'pawn' && to === state.enPassantSquare) {
    const capturedPawnIdx = piece.color === 'white' ? to - 8 : to + 8;
    s.board[capturedPawnIdx] = null;
  }

  // Move the piece
  s.board[to] = promotion ? { type: promotion, color: piece.color } : { ...piece };
  s.board[from] = null;

  // Castling rook movement
  if (piece.type === 'king') {
    const diff = to - from;
    if (Math.abs(diff) === 2) {
      if (diff === 2) {
        // Kingside
        const rookFrom = from + 3;
        const rookTo = from + 1;
        s.board[rookTo] = s.board[rookFrom];
        s.board[rookFrom] = null;
      } else {
        // Queenside
        const rookFrom = from - 4;
        const rookTo = from - 1;
        s.board[rookTo] = s.board[rookFrom];
        s.board[rookFrom] = null;
      }
    }
  }

  // Update castling rights
  if (piece.type === 'king') {
    if (piece.color === 'white') {
      s.castlingRights.K = false;
      s.castlingRights.Q = false;
    } else {
      s.castlingRights.k = false;
      s.castlingRights.q = false;
    }
  }
  if (piece.type === 'rook') {
    if (from === 0) s.castlingRights.Q = false;
    if (from === 7) s.castlingRights.K = false;
    if (from === 56) s.castlingRights.q = false;
    if (from === 63) s.castlingRights.k = false;
  }
  if (captured && captured.type === 'rook') {
    if (to === 0) s.castlingRights.Q = false;
    if (to === 7) s.castlingRights.K = false;
    if (to === 56) s.castlingRights.q = false;
    if (to === 63) s.castlingRights.k = false;
  }

  // En passant square
  if (
    piece.type === 'pawn' &&
    Math.abs(to - from) === 16
  ) {
    s.enPassantSquare = piece.color === 'white' ? from + 8 : from - 8;
  } else {
    s.enPassantSquare = null;
  }

  // Halfmove clock
  if (piece.type === 'pawn' || captured) {
    s.halfmoveClock = 0;
  } else {
    s.halfmoveClock = state.halfmoveClock + 1;
  }

  // Fullmove number
  if (state.activeColor === 'black') {
    s.fullmoveNumber = state.fullmoveNumber + 1;
  }

  // Switch active color
  s.activeColor = state.activeColor === 'white' ? 'black' : 'white';

  return s;
}

// ---------------------------------------------------------------------------
// ChessEngine
// ---------------------------------------------------------------------------

export class ChessEngine {
  private state: GameState;
  private history: MoveRecord[];

  constructor() {
    this.state = getStartingGameState();
    this.history = [];
  }

  // -----------------------------------------------------------------------
  // reset
  // -----------------------------------------------------------------------

  reset(fisher?: boolean): void {
    if (fisher) {
      this.state = this.generateChess960State();
    } else {
      this.state = getStartingGameState();
    }
    this.history = [];
  }

  private generateChess960State(): GameState {
    // Generate a valid Chess960 back rank
    const pieces: (PieceType | null)[] = Array(8).fill(null);

    // 1. Place bishops on opposite colored squares
    const lightSquares = [0, 2, 4, 6]; // even files = light squares in rank context
    const darkSquares = [1, 3, 5, 7];
    const lightIdx = lightSquares[Math.floor(Math.random() * lightSquares.length)];
    const darkIdx = darkSquares[Math.floor(Math.random() * darkSquares.length)];
    pieces[lightIdx] = 'bishop';
    pieces[darkIdx] = 'bishop';

    // 2. Place queen on a random empty square
    const emptyAfterBishops = pieces
      .map((p, i) => (p === null ? i : -1))
      .filter((i) => i >= 0);
    const queenIdx =
      emptyAfterBishops[Math.floor(Math.random() * emptyAfterBishops.length)];
    pieces[queenIdx] = 'queen';

    // 3. Place knights on 2 random empty squares
    const emptyAfterQueen = pieces
      .map((p, i) => (p === null ? i : -1))
      .filter((i) => i >= 0);
    const knight1Pos = Math.floor(Math.random() * emptyAfterQueen.length);
    const knight1Idx = emptyAfterQueen[knight1Pos];
    pieces[knight1Idx] = 'knight';
    const emptyAfterKnight1 = emptyAfterQueen.filter((_, i) => i !== knight1Pos);
    const knight2Idx =
      emptyAfterKnight1[Math.floor(Math.random() * emptyAfterKnight1.length)];
    pieces[knight2Idx] = 'knight';

    // 4. Place rook, king, rook in the remaining 3 squares (king between rooks)
    const remaining = pieces
      .map((p, i) => (p === null ? i : -1))
      .filter((i) => i >= 0);
    // remaining has exactly 3 indices in ascending order
    pieces[remaining[0]] = 'rook';
    pieces[remaining[1]] = 'king';
    pieces[remaining[2]] = 'rook';

    // Build the board
    const board: Board = Array(64).fill(null);
    for (let f = 0; f < 8; f++) {
      board[f] = { type: pieces[f]!, color: 'white' };
      board[8 + f] = { type: 'pawn', color: 'white' };
      board[48 + f] = { type: 'pawn', color: 'black' };
      board[56 + f] = { type: pieces[f]!, color: 'black' };
    }

    return {
      board,
      activeColor: 'white',
      castlingRights: { K: true, Q: true, k: true, q: true },
      enPassantSquare: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
    };
  }

  // -----------------------------------------------------------------------
  // getFEN
  // -----------------------------------------------------------------------

  getFEN(): string {
    const { board, activeColor, castlingRights, enPassantSquare, halfmoveClock, fullmoveNumber } =
      this.state;

    // 1. Piece placement (rank 7 → 0)
    const ranks: string[] = [];
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      let rankStr = '';
      for (let file = 0; file < 8; file++) {
        const piece = board[rank * 8 + file];
        if (piece) {
          if (empty > 0) {
            rankStr += empty;
            empty = 0;
          }
          rankStr += pieceToFenChar(piece);
        } else {
          empty++;
        }
      }
      if (empty > 0) rankStr += empty;
      ranks.push(rankStr);
    }
    const placement = ranks.join('/');

    // 2. Active color
    const color = activeColor === 'white' ? 'w' : 'b';

    // 3. Castling
    let castling = '';
    if (castlingRights.K) castling += 'K';
    if (castlingRights.Q) castling += 'Q';
    if (castlingRights.k) castling += 'k';
    if (castlingRights.q) castling += 'q';
    if (!castling) castling = '-';

    // 4. En passant
    const ep = enPassantSquare !== null ? squareToAlgebraic(enPassantSquare) : '-';

    return `${placement} ${color} ${castling} ${ep} ${halfmoveClock} ${fullmoveNumber}`;
  }

  // -----------------------------------------------------------------------
  // setFEN
  // -----------------------------------------------------------------------

  setFEN(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    if (parts.length !== 6) {
      throw new Error(`Invalid FEN: expected 6 space-separated fields, got ${parts.length}`);
    }

    const [placement, color, castling, ep, halfmove, fullmove] = parts;

    // Parse piece placement
    const board: Board = Array(64).fill(null);
    const rankStrs = placement.split('/');
    if (rankStrs.length !== 8) {
      throw new Error(`Invalid FEN piece placement: expected 8 ranks, got ${rankStrs.length}`);
    }

    for (let i = 0; i < 8; i++) {
      const rank = 7 - i; // FEN starts from rank 8 (index 7)
      let file = 0;
      for (const ch of rankStrs[i]) {
        if (ch >= '1' && ch <= '8') {
          file += parseInt(ch, 10);
        } else {
          if (file >= 8) {
            throw new Error(`Invalid FEN piece placement: too many squares in rank ${8 - i}`);
          }
          board[rank * 8 + file] = fenCharToPiece(ch);
          file++;
        }
      }
      if (file !== 8) {
        throw new Error(
          `Invalid FEN piece placement: rank ${8 - i} has ${file} squares instead of 8`,
        );
      }
    }

    // Parse active color
    if (color !== 'w' && color !== 'b') {
      throw new Error(`Invalid FEN active color: expected 'w' or 'b', got '${color}'`);
    }
    const activeColor: PieceColor = color === 'w' ? 'white' : 'black';

    // Parse castling
    if (!/^(-|[KQkq]{1,4})$/.test(castling)) {
      throw new Error(`Invalid FEN castling rights: '${castling}'`);
    }
    const castlingRights: CastlingRights = {
      K: castling.includes('K'),
      Q: castling.includes('Q'),
      k: castling.includes('k'),
      q: castling.includes('q'),
    };

    // Parse en passant
    let enPassantSquare: number | null = null;
    if (ep !== '-') {
      if (!/^[a-h][36]$/.test(ep)) {
        throw new Error(`Invalid FEN en passant square: '${ep}'`);
      }
      enPassantSquare = algebraicToSquare(ep);
    }

    // Parse halfmove clock
    const halfmoveClock = parseInt(halfmove, 10);
    if (isNaN(halfmoveClock) || halfmoveClock < 0) {
      throw new Error(`Invalid FEN halfmove clock: '${halfmove}'`);
    }

    // Parse fullmove number
    const fullmoveNumber = parseInt(fullmove, 10);
    if (isNaN(fullmoveNumber) || fullmoveNumber < 1) {
      throw new Error(`Invalid FEN fullmove number: '${fullmove}'`);
    }

    this.state = {
      board,
      activeColor,
      castlingRights,
      enPassantSquare,
      halfmoveClock,
      fullmoveNumber,
    };
    this.history = [];
  }

  // -----------------------------------------------------------------------
  // moveUCI
  // -----------------------------------------------------------------------

  moveUCI(uci: string): { success: true } | { success: false; error: string } {
    // Validate format
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
      return { success: false, error: `Invalid UCI format: '${uci}'` };
    }

    const fromStr = uci.substring(0, 2);
    const toStr = uci.substring(2, 4);
    const promoChar = uci.length === 5 ? uci[4] : null;
    const fromIndex = algebraicToSquare(fromStr);
    const toIndex = algebraicToSquare(toStr);

    // Check piece at from square
    const piece = this.state.board[fromIndex];
    if (!piece) {
      return { success: false, error: `No piece at ${fromStr}` };
    }

    // Check correct turn
    if (piece.color !== this.state.activeColor) {
      return {
        success: false,
        error: `It is ${this.state.activeColor}'s turn, but piece at ${fromStr} is ${piece.color}`,
      };
    }

    // Check legal moves
    const legalMoves = getLegalMoves(this.state, fromIndex);
    if (!legalMoves.includes(toIndex)) {
      return { success: false, error: `Move ${fromStr}${toStr} is not legal` };
    }

    // Parse promotion
    const promotion = promoChar ? promotionCharToType(promoChar) : null;

    // Record state before move
    const stateBefore = cloneState(this.state);

    // Determine captured piece
    let captured: PieceType | null = null;
    const targetPiece = this.state.board[toIndex];
    if (targetPiece) {
      captured = targetPiece.type;
    } else if (piece.type === 'pawn' && toIndex === this.state.enPassantSquare) {
      captured = 'pawn';
    }

    // Determine castling
    const isCastleKingside =
      piece.type === 'king' && toIndex - fromIndex === 2;
    const isCastleQueenside =
      piece.type === 'king' && fromIndex - toIndex === 2;

    // Execute the move
    this.state = applyMoveToState(this.state, fromIndex, toIndex, promotion);

    // Record in history
    this.history.push({
      piece: piece.type,
      color: piece.color,
      from: fromIndex,
      to: toIndex,
      captured,
      promotion,
      isCastleKingside,
      isCastleQueenside,
      stateBefore,
    });

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // moveSAN
  // -----------------------------------------------------------------------

  moveSAN(san: string): { success: true } | { success: false; error: string } {
    // Strip check/checkmate suffixes
    const cleaned = san.replace(/[+#]$/, '').trim();

    // Castling
    if (cleaned === 'O-O' || cleaned === '0-0') {
      const rank = this.state.activeColor === 'white' ? 0 : 7;
      return this.moveUCI(
        squareToAlgebraic(rank * 8 + 4) + squareToAlgebraic(rank * 8 + 6),
      );
    }
    if (cleaned === 'O-O-O' || cleaned === '0-0-0') {
      const rank = this.state.activeColor === 'white' ? 0 : 7;
      return this.moveUCI(
        squareToAlgebraic(rank * 8 + 4) + squareToAlgebraic(rank * 8 + 2),
      );
    }

    // Parse SAN: [KQRBN]?[a-h]?[1-8]?[x]?[a-h][1-8]([=][QRBN])?
    let pos = 0;
    let pieceType: PieceType = 'pawn';
    let disambigFile: number | null = null;
    let disambigRank: number | null = null;
    let toFile: number;
    let toRank: number;
    let promotion: PieceType | null = null;

    // Piece prefix
    if (pos < cleaned.length && 'KQRBN'.includes(cleaned[pos])) {
      pieceType = sanPrefixToPieceType(cleaned[pos]);
      pos++;
    }

    // Find the target square — it's always the last [a-h][1-8] before optional =promo
    // Work backwards from the end to find target square
    let promoStr = '';
    let core = cleaned.slice(pos);
    // Support both "=Q" and "Q" promotion suffixes (e.g. b1=Q or b1Q)
    const promoMatch = core.match(/=([QRBNqrbn])$/) || core.match(/([QRBNqrbn])$/);
    if (promoMatch) {
      promoStr = promoMatch[1];
      core = core.slice(0, -promoMatch[0].length);
    }

    // Remove capture marker
    core = core.replace('x', '');

    // Last two chars are the target square
    if (core.length < 2) {
      return { success: false, error: `Invalid SAN: '${san}'` };
    }
    const targetStr = core.slice(-2);
    if (!/^[a-h][1-8]$/.test(targetStr)) {
      return { success: false, error: `Invalid SAN target square: '${san}'` };
    }
    toFile = targetStr.charCodeAt(0) - 97;
    toRank = parseInt(targetStr[1], 10) - 1;
    const toIndex = toRank * 8 + toFile;

    // Remaining prefix is disambiguation
    const disambig = core.slice(0, -2);
    for (const ch of disambig) {
      if (ch >= 'a' && ch <= 'h') {
        disambigFile = ch.charCodeAt(0) - 97;
      } else if (ch >= '1' && ch <= '8') {
        disambigRank = parseInt(ch, 10) - 1;
      }
    }

    // Promotion
    if (promoStr) {
      promotion = promotionCharToType(promoStr);
    }

    // Find the matching piece
    const color = this.state.activeColor;
    let foundFrom: number | null = null;

    for (let i = 0; i < 64; i++) {
      const p = this.state.board[i];
      if (!p || p.type !== pieceType || p.color !== color) continue;
      if (disambigFile !== null && i % 8 !== disambigFile) continue;
      if (disambigRank !== null && Math.floor(i / 8) !== disambigRank) continue;

      const legal = getLegalMoves(this.state, i);
      if (!legal.includes(toIndex)) continue;

      if (foundFrom !== null) {
        return { success: false, error: `Ambiguous SAN: '${san}'` };
      }
      foundFrom = i;
    }

    if (foundFrom === null) {
      return { success: false, error: `No legal move matches SAN: '${san}'` };
    }

    // Build UCI and delegate
    let uci = squareToAlgebraic(foundFrom) + squareToAlgebraic(toIndex);
    if (promotion) {
      const promoMap: Record<PieceType, string> = {
        queen: 'q', rook: 'r', bishop: 'b', knight: 'n', king: '', pawn: '',
      };
      uci += promoMap[promotion];
    }

    return this.moveUCI(uci);
  }

  // -----------------------------------------------------------------------
  // getSAN
  // -----------------------------------------------------------------------

  getSAN(): string[] {
    return this.history.map((move) => {
      // Castling
      if (move.isCastleKingside) {
        return this.appendCheckSuffix(move, 'O-O');
      }
      if (move.isCastleQueenside) {
        return this.appendCheckSuffix(move, 'O-O-O');
      }

      let san = '';

      const prefix = pieceTypeSanPrefix(move.piece);

      if (move.piece === 'pawn') {
        // Pawn moves
        if (move.captured) {
          // Pawn capture: include file letter before 'x'
          san += String.fromCharCode(97 + (move.from % 8));
          san += 'x';
        }
        san += squareToAlgebraic(move.to);
        if (move.promotion) {
          san += '=' + promotionTypeToSan(move.promotion);
        }
      } else {
        // Non-pawn piece
        san += prefix;

        // Disambiguation
        const disambiguation = this.getDisambiguation(move);
        san += disambiguation;

        if (move.captured) {
          san += 'x';
        }
        san += squareToAlgebraic(move.to);
      }

      return this.appendCheckSuffix(move, san);
    });
  }

  private getDisambiguation(move: MoveRecord): string {
    const { stateBefore } = move;

    // Find all pieces of the same type and color that can also move to the target
    const candidates: number[] = [];
    for (let i = 0; i < 64; i++) {
      if (i === move.from) continue;
      const p = stateBefore.board[i];
      if (p && p.type === move.piece && p.color === move.color) {
        const moves = getLegalMoves(stateBefore, i);
        if (moves.includes(move.to)) {
          candidates.push(i);
        }
      }
    }

    if (candidates.length === 0) return '';

    const fromFile = move.from % 8;
    const fromRank = Math.floor(move.from / 8);

    // Check if file alone disambiguates
    const sameFile = candidates.some((c) => c % 8 === fromFile);
    const sameRank = candidates.some((c) => Math.floor(c / 8) === fromRank);

    if (!sameFile) {
      // File alone is enough
      return String.fromCharCode(97 + fromFile);
    }
    if (!sameRank) {
      // Rank alone is enough
      return String(fromRank + 1);
    }
    // Need both
    return String.fromCharCode(97 + fromFile) + (fromRank + 1);
  }

  private appendCheckSuffix(move: MoveRecord, san: string): string {
    // Apply the move to get the resulting state
    const stateAfter = applyMoveToState(
      move.stateBefore,
      move.from,
      move.to,
      move.promotion,
    );

    const opponentColor: PieceColor =
      move.color === 'white' ? 'black' : 'white';

    if (isCheckmate(stateAfter, opponentColor)) {
      return san + '#';
    }
    if (isInCheck(stateAfter, opponentColor)) {
      return san + '+';
    }
    return san;
  }

  // -----------------------------------------------------------------------
  // Accessors (useful for consumers)
  // -----------------------------------------------------------------------

  getState(): GameState {
    return cloneState(this.state);
  }

  getHistory(): MoveRecord[] {
    return this.history.map((m) => ({ ...m, stateBefore: cloneState(m.stateBefore) }));
  }
}
