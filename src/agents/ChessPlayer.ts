import { generateText, tool, type ModelMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { PlayerConfig, PlayerStatus, Message, ToolCallData, ChessColor, MoveCommand } from '../types';

const API_KEY_STORAGE = 'openrouter_api_key';

export class ChessPlayer {
  readonly id: string;
  name: string;
  readonly color: ChessColor;
  model: string;
  systemPrompt: string;
  fischer960: boolean = false;

  private _status: PlayerStatus = 'idle';
  private _error: string | null = null;
  private _messageLog: { timestamp: number; messages: unknown[] }[] = [];
  private openrouter: ReturnType<typeof createOpenRouter>;

  constructor(config: PlayerConfig) {
    this.id = crypto.randomUUID();
    this.name = config.name;
    this.color = config.color;
    this.model = config.model;
    this.systemPrompt = config.systemPrompt;

    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    this.openrouter = createOpenRouter({ apiKey: apiKey || '' });
  }

  get status(): PlayerStatus {
    return this._status;
  }

  get error(): string | null {
    return this._error;
  }

  get messageLog(): { timestamp: number; messages: unknown[] }[] {
    return this._messageLog;
  }

  clearLog(): void {
    this._messageLog = [];
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

  /** Index of a context message in the converted ModelMessage array, with its move number */
  private convertMessages(messages: Message[], opponent?: { name: string; color: ChessColor }): {
    messages: ModelMessage[];
    /** Maps converted array index → moveNumber for context (MoveCommand) messages */
    moveCommandIndices: Map<number, number>;
  } {
    const opponentInfo = opponent
      ? ` Your opponent is ${opponent.name}, playing ${opponent.color}.`
      : '';
    const modeInfo = this.fischer960 ? ' This is a Chess960 (Fischer Random) game — pieces start in a randomized position.' : '';
    const result: ModelMessage[] = [
      { role: 'user', content: `[SYSTEM]: Chess game started.${modeInfo} You are ${this.name}, playing ${this.color}.${opponentInfo} Make your moves using the 'make-move' tool after ${MoveCommand}. Confirm your name and color and your ready to play.` },
      { role: 'assistant', content: `I am ${this.name}, playing ${this.color}. I will use the 'make-move' tool to submit my moves after ${MoveCommand}.` },
    ];
    const moveCommandIndices = new Map<number, number>();

    for (const m of messages) {
      if (!m.content && !m.toolCalls?.length && !m.toolResultFor) continue;

      // Tool result for this agent's tool call
      if (m.toolResultFor && m.agentId === this.id) {
        result.push({
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: m.toolResultFor.callId,
              toolName: m.toolResultFor.toolName,
              output: { type: 'text' as const, value: m.content },
            },
          ],
        });
        continue;
      }

      // Opponent's tool result → adapt to "Opponent played XXX"
      if (m.toolResultFor && m.agentId !== this.id) {
        const moveMatch = m.content.match(/^Move\s+(\S+)\s+accepted/);
        if (moveMatch) {
          result.push({ role: 'user', content: `[SYSTEM]: Opponent played ${moveMatch[1]}.` });
        }
        continue;
      }

      // Skip opponent's context message (system with another agent's ID)
      if (m.sender === 'system' && m.agentId && m.agentId !== this.id) {
        continue;
      }

      // This agent's own messages
      if (m.sender === 'agent' && m.agentId === this.id) {
        if (m.toolCalls?.length) {
          const content: Array<
            | { type: 'text'; text: string }
            | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
          > = [];
          if (m.content) {
            content.push({ type: 'text', text: m.content });
          }
          for (const tc of m.toolCalls) {
            content.push({
              type: 'tool-call',
              toolCallId: tc.id,
              toolName: tc.tool,
              input: tc.args,
            });
          }
          result.push({ role: 'assistant' as const, content });
        } else {
          result.push({ role: 'assistant', content: m.content });
        }
        continue;
      }

      // Opponent's agent messages — show text without name
      if (m.sender === 'agent' && m.agentId !== this.id) {
        if (m.content) {
          result.push({ role: 'user', content: `[@${m.agentName || 'OPPONENT'}]: ${m.content}` });
        }
        continue;
      }

      // Moderator and generic system messages
      let label: string;
      if (m.sender === 'system') {
        label = '[SYSTEM]';
      } else {
        label = '[MODERATOR]';
      }
      if (m.moveNumber != null) {
        moveCommandIndices.set(result.length, m.moveNumber);
      }
      result.push({ role: 'user', content: `${label}: ${m.content}` });
    }

    return { messages: result, moveCommandIndices };
  }

  private get isAnthropicModel(): boolean {
    return this.model.startsWith('anthropic/');
  }

  private withAnthropicPromptCache(
    messages: ModelMessage[],
    moveCommandIndices: Map<number, number>,
    moveNumber: number,
  ): ModelMessage[] {
    if (!this.isAnthropicModel || moveNumber < 2) return messages;

    // Place a single cache breakpoint so the stable prefix gets cached.
    // Breakpoint advances every 10 full moves (at moves 1, 11, 21, ...).
    const cacheEvery = 10;
    const breakpointMove = Math.floor((moveNumber - 1) / cacheEvery) * cacheEvery + 1;

    // Find the last context message whose moveNumber <= breakpointMove
    let breakpointIndex = -1;
    moveCommandIndices.forEach((msgMoveNum, index) => {
      if (msgMoveNum <= breakpointMove) {
        breakpointIndex = index;
      }
    });

    if (breakpointIndex === -1) return messages;

    return messages.map((message, index) => {
      if (index !== breakpointIndex) return message;

      return {
        ...message,
        content: [
          {
            type: 'text',
            text: message.content as string,
            providerOptions: {
              openrouter: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      } as ModelMessage;
    });
  }

  async generate(messages: Message[], opponent?: { name: string; color: ChessColor }, moveNumber: number = 1): Promise<{ text: string; toolCalls: ToolCallData[]; cost: number }> {
    this._status = 'thinking';
    this._error = null;

    try {
      if (!localStorage.getItem(API_KEY_STORAGE)) {
        throw new Error('OpenRouter API key not set. Configure in Settings.');
      }
      const converted = this.convertMessages(messages, opponent);
      const coreMessages = this.withAnthropicPromptCache(converted.messages, converted.moveCommandIndices, moveNumber);

      const result = await generateText({
        model: this.openrouter(this.model),
        system: this.systemPrompt,
        messages: coreMessages,
        tools: this.tools,
      });

      console.log('[ChessPlayer] generateText usage', result.usage);
      console.log('[ChessPlayer] generateText openrouter metadata', result.providerMetadata?.openrouter);

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

      // Build log entry with request + response
      const responseEntry: Record<string, unknown> = { role: 'assistant' };
      if (responseText) responseEntry.text = responseText;
      if (toolCalls.length > 0) responseEntry.toolCalls = toolCalls;
      if (result.usage) responseEntry.usage = result.usage;
      this._messageLog.push({
        timestamp: Date.now(),
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...coreMessages,
          responseEntry,
        ],
      });

      this._status = 'idle';
      const cost = typeof result.usage?.raw?.cost === 'number' ? result.usage.raw.cost : 0;
      return { text: responseText, toolCalls, cost };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this._status = 'error';
      this._error = errorMessage;
      throw err;
    }
  }
}
