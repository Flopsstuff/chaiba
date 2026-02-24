import { useState, useCallback, useRef } from 'react';
import { ChessPlayer } from '../agents/ChessPlayer';
import { PlayerConfig, PlayerStatus, Message, ToolCallData } from '../types';

export interface UseChessPlayerReturn {
  messages: ReadonlyArray<Message>;
  status: PlayerStatus;
  error: string | null;
  generate: (prompt: string) => Promise<{ text: string; toolCalls: ToolCallData[] }>;
  addSystemMessage: (content: string) => void;
  reset: () => void;
}

export function useChessPlayer(config: PlayerConfig): UseChessPlayerReturn {
  const playerRef = useRef<ChessPlayer | null>(null);

  // Lazy-init so we don't construct on every render
  function getPlayer(): ChessPlayer {
    if (!playerRef.current) {
      playerRef.current = new ChessPlayer(config);
    }
    return playerRef.current;
  }

  const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string) => {
    const player = getPlayer();
    setStatus('thinking');
    setError(null);

    try {
      const result = await player.generate(prompt);
      setMessages([...player.messages]);
      setStatus('idle');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setError(msg);
      setMessages([...player.messages]);
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    const player = getPlayer();
    player.addSystemMessage(content);
    setMessages([...player.messages]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    const player = getPlayer();
    player.reset();
    setMessages([]);
    setStatus('idle');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { messages, status, error, generate, addSystemMessage, reset };
}
