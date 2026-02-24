import { generateText, tool } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { PlayerConfig, PlayerStatus, Message, ToolCallData, ChessColor } from '../types';

const API_KEY_STORAGE = 'openrouter_api_key';

export class ChessPlayer {
  readonly name: string;
  readonly color: ChessColor;
  readonly model: string;
  readonly systemPrompt: string;

  private _status: PlayerStatus = 'idle';
  private _error: string | null = null;
  private _messages: Message[] = [];
  private openrouter: ReturnType<typeof createOpenRouter>;

  constructor(config: PlayerConfig) {
    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    if (!apiKey) {
      throw new Error('OpenRouter API key not set. Configure in Settings.');
    }

    this.name = config.name;
    this.color = config.color;
    this.model = config.model;
    this.systemPrompt = config.systemPrompt;
    this.openrouter = createOpenRouter({ apiKey });
  }

  get status(): PlayerStatus {
    return this._status;
  }

  get error(): string | null {
    return this._error;
  }

  get messages(): ReadonlyArray<Message> {
    return this._messages;
  }

  private get tools() {
    return {
      'make-move': tool({
        description: 'Submit your chess move in algebraic notation.',
        inputSchema: z.object({
          move: z.string().describe('Chess move in algebraic notation (e.g. e4, Nf3, O-O)'),
          reasoning: z.string().optional().describe('Brief explanation of why you chose this move'),
        }),
      }),
    };
  }

  async generate(prompt: string): Promise<{ text: string; toolCalls: ToolCallData[] }> {
    this._status = 'thinking';
    this._error = null;

    this._messages.push({ sender: 'user', content: prompt });

    try {
      const result = await generateText({
        model: this.openrouter(this.model),
        system: this.systemPrompt,
        messages: this._messages.map((m) => ({
          role: m.sender === 'player' ? 'assistant' as const : 'user' as const,
          content: m.sender === 'system' ? `[SYSTEM]: ${m.content}` : m.content,
        })),
        tools: this.tools,
      });

      const toolCalls: ToolCallData[] = [];
      if (result.toolCalls) {
        for (const tc of result.toolCalls) {
          toolCalls.push({
            id: tc.toolCallId,
            tool: tc.toolName,
            args: tc.input as Record<string, unknown>,
          });
        }
      }

      const responseText = result.text || '';

      this._messages.push({
        sender: 'player',
        content: responseText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      this._status = 'idle';
      return { text: responseText, toolCalls };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this._status = 'error';
      this._error = errorMessage;
      throw err;
    }
  }

  addSystemMessage(content: string): void {
    this._messages.push({ sender: 'system', content });
  }

  reset(): void {
    this._messages = [];
    this._status = 'idle';
    this._error = null;
  }
}
