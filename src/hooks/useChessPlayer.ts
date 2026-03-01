import { useState, useCallback, useRef } from 'react';
import { ChessPlayer } from '../agents/ChessPlayer';
import { ChessColor, PlayerConfig, PlayerStatus, Message, ToolCallData } from '../types';

export interface LogEntry {
  timestamp: number;
  messages: unknown[];
}

export interface UseChessPlayerReturn {
  id: string;
  name: string;
  status: PlayerStatus;
  error: string | null;
  messageLog: LogEntry[];
  generate: (messages: Message[], opponent?: { name: string; color: ChessColor }) => Promise<{ text: string; toolCalls: ToolCallData[]; cost: number }>;
  clearLog: () => void;
}

export function useChessPlayer(config: PlayerConfig): UseChessPlayerReturn {
  const playerRef = useRef<ChessPlayer | null>(null);

  function getPlayer(): ChessPlayer {
    if (!playerRef.current) {
      playerRef.current = new ChessPlayer(config);
    }
    return playerRef.current;
  }

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [messageLog, setMessageLog] = useState<LogEntry[]>([]);

  const player = getPlayer();
  player.name = config.name;
  player.model = config.model;
  player.systemPrompt = config.systemPrompt;
  player.fischer960 = !!config.fischer960;

  const id = player.id;
  const name = player.name;

  const generate = useCallback(async (messages: Message[], opponent?: { name: string; color: ChessColor }) => {
    const player = getPlayer();
    setStatus('thinking');
    setError(null);

    try {
      const result = await player.generate(messages, opponent);
      setMessageLog([...player.messageLog]);
      setStatus('idle');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessageLog([...getPlayer().messageLog]);
      setStatus('error');
      setError(msg);
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearLog = useCallback(() => {
    getPlayer().clearLog();
    setMessageLog([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { id, name, status, error, messageLog, generate, clearLog };
}
