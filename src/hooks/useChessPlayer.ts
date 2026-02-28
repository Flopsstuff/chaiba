import { useState, useCallback, useRef } from 'react';
import { ChessPlayer } from '../agents/ChessPlayer';
import { PlayerConfig, PlayerStatus, Message, ToolCallData } from '../types';

export interface UseChessPlayerReturn {
  id: string;
  name: string;
  status: PlayerStatus;
  error: string | null;
  generate: (messages: Message[]) => Promise<{ text: string; toolCalls: ToolCallData[] }>;
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

  const id = getPlayer().id;
  const name = getPlayer().name;

  const generate = useCallback(async (messages: Message[]) => {
    const player = getPlayer();
    setStatus('thinking');
    setError(null);

    try {
      const result = await player.generate(messages);
      setStatus('idle');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setError(msg);
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { id, name, status, error, generate };
}
