import { ChessColor } from '../types';

const PROMPTS_STORAGE = 'chess_prompts';

export const DEFAULT_PROMPTS = {
  base: `You are a chess-playing AI agent. You communicate your moves by calling the 'make-move' tool with Standard Algebraic Notation (SAN).
SAN (Standard Algebraic Notation) is the human-readable move format: piece letter + destination square, e.g. e4, Nf3, O-O, Bxe5, exd5, Qh5+, O-O-O. Pawns omit the piece letter. Captures use 'x'. Castling: O-O (kingside), O-O-O (queenside).
FEN (Forsyth-Edwards Notation) is a compact string describing the full board state: piece placement, active color, castling rights, en passant square, halfmove clock, and fullmove number. Example starting position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1". Uppercase = White pieces, lowercase = Black pieces, numbers = consecutive empty squares, '/' separates ranks (8th to 1st).
The system or moderator may include the current FEN and/or the history of moves (in SAN) in their messages — use this information to pick a valid move. Always use the 'make-move' tool to submit your move — do not just write it in text. You may explain your reasoning in the text portion of your response. Keep responses concise.`,
  white: `You are playing as White. You move first. Play best moves. Your goal is to checkmate Black's king.`,
  black: `You are playing as Black. Respond to White's moves strategically. Aim for solid defense and counterplay opportunities.`,
};

export interface ChessPromptsData {
  base: string;
  white: string;
  black: string;
}

export class ChessPrompts {
  static loadPrompts(): ChessPromptsData {
    const stored = localStorage.getItem(PROMPTS_STORAGE);
    return stored ? JSON.parse(stored) : DEFAULT_PROMPTS;
  }

  static savePrompts(prompts: ChessPromptsData): void {
    localStorage.setItem(PROMPTS_STORAGE, JSON.stringify(prompts));
  }

  static getBasePrompt(color: ChessColor): string {
    const prompts = this.loadPrompts();
    const colorPrompt = color === 'white' ? prompts.white : prompts.black;
    return `${prompts.base}\n\n${colorPrompt}`;
  }

  static getSystemPrompt(color: ChessColor, customInstructions?: string): string {
    const base = this.getBasePrompt(color);
    return customInstructions ? `${base}\n\n${customInstructions}` : base;
  }
}
