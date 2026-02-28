import { generateText, tool, type ModelMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { PlayerConfig, PlayerStatus, Message, ToolCallData, ChessColor } from '../types';

const API_KEY_STORAGE = 'openrouter_api_key';

export class ChessPlayer {
  readonly id: string;
  readonly name: string;
  readonly color: ChessColor;
  readonly model: string;
  readonly systemPrompt: string;

  private _status: PlayerStatus = 'idle';
  private _error: string | null = null;
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

  // Converts internal messages to OpenRouter messages adds system prompt and initial messages
  private convertMessages(messages: Message[]): ModelMessage[] {
    const result: ModelMessage[] = [
      { role: 'user', content: `Chess game started. You are ${this.name}, playing ${this.color}. Make your moves using the 'make-move' tool.` },
      { role: 'assistant', content: `I am ${this.name}, playing ${this.color}. I will use the 'make-move' tool to submit my moves.` },
    ];

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

      // Other messages → user role with label
      let label: string;
      if (m.sender === 'system') {
        label = '[SYSTEM]';
      } else if (m.sender === 'moderator') {
        label = '[MODERATOR]';
      } else {
        label = `[@${m.agentName || 'OPPONENT'}]`;
      }
      result.push({ role: 'user', content: `${label}: ${m.content}` });
    }

    return result;
  }

  private get isAnthropicModel(): boolean {
    return this.model.startsWith('anthropic/');
  }

  private withAnthropicPromptCache(messages: ModelMessage[]): ModelMessage[] {
    if (!this.isAnthropicModel) return messages;

    // Anthropic prompt caching works best on stable prefix blocks.
    return messages.map((message, index) => {
      if (index > 1) return message;
      if (typeof message.content !== 'string') return message;

      return {
        ...message,
        content: [
          {
            type: 'text',
            text: message.content,
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

  async generate(messages: Message[]): Promise<{ text: string; toolCalls: ToolCallData[] }> {
    this._status = 'thinking';
    this._error = null;

    try {
      if (!localStorage.getItem(API_KEY_STORAGE)) {
        throw new Error('OpenRouter API key not set. Configure in Settings.');
      }
      const coreMessages = this.withAnthropicPromptCache(this.convertMessages(messages));

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
      this._status = 'idle';
      return { text: responseText, toolCalls };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this._status = 'error';
      this._error = errorMessage;
      throw err;
    }
  }
}
