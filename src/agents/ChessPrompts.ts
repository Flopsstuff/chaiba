import { ChessColor } from '../types';

const PROMPTS_STORAGE = 'chess_prompts';

export const DEFAULT_PROMPTS = {
  base: `You are a chess-playing AI agent. You communicate your moves by calling the make-move tool with algebraic notation (e.g. e4, Nf3, O-O, exd5). Always use the make-move tool to submit your move — do not just write it in text. You may explain your reasoning in the text portion of your response. Keep responses concise.`,
  white: `You are playing as White. You move first. Look for strong opening principles: control the center, develop pieces, and castle early.`,
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
