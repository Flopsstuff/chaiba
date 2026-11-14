export type ChessColor = 'white' | 'black';

export type PlayerStatus = 'idle' | 'thinking' | 'error';

export type MessageSender = 'system' | 'moderator' | 'agent';

export const MoveCommand: string = '<make your move now>';

export interface ToolCallData {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface Message {
  sender: MessageSender;
  agentId?: string;
  agentName?: string;
  content: string;
  toolCalls?: ToolCallData[];
  toolResultFor?: {
    callId: string;
    toolName: string;
  };
  /** For context messages: the engine's fullmoveNumber when this message was created */
  moveNumber?: number;
  /** For context messages: whose turn it is */
  moveColor?: ChessColor;
}

/** What one LLM call returned, beyond the text and tool calls. */
export interface GenerateMeta {
  reasoning?: string;
  finishReason?: string;
  usage?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
  responseId?: string;
  responseModel?: string;
}

export interface GenerateResult {
  text: string;
  toolCalls: ToolCallData[];
  cost: number;
  meta: GenerateMeta;
}

export type Opponent = { name: string; color: ChessColor };

/** A past LLM call, as needed to rebuild an agent's message log. */
export interface LogRestoreEntry {
  timestamp: number;
  messages: Message[];
  opponent?: Opponent;
  moveNumber: number;
  response: Record<string, unknown>;
}

export interface PlayerConfig {
  /** Agent id; generated when omitted. Set when restoring a saved game. */
  id?: string;
  name: string;
  color: ChessColor;
  model: string;
  systemPrompt: string;
  fischer960?: boolean;
}
