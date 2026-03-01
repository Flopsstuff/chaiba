export type ChessColor = 'white' | 'black';

export type PlayerStatus = 'idle' | 'thinking' | 'error';

export type MessageSender = 'system' | 'moderator' | 'agent';

export const MoveCommand: String = '<make your move now>';

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

export interface PlayerConfig {
  name: string;
  color: ChessColor;
  model: string;
  systemPrompt: string;
  fischer960?: boolean;
}
