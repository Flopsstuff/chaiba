export type ChessColor = 'white' | 'black';

export type PlayerStatus = 'idle' | 'thinking' | 'error';

export type MessageSender = 'system' | 'player' | 'user';

export interface ToolCallData {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface Message {
  sender: MessageSender;
  content: string;
  toolCalls?: ToolCallData[];
}

export interface PlayerConfig {
  name: string;
  color: ChessColor;
  model: string;
  systemPrompt: string;
}
