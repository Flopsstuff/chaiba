import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { ColorSpinner } from '../ColorSpinner';
import type { ChessColor } from '../../types';
import './GameChat.css';

type MessageRole = 'white' | 'black' | 'moderator' | 'system';

interface Message {
  id: number;
  role: MessageRole;
  text: string;
  sender?: string;
}

export interface GameChatHandle {
  addSystemMessage: (text: string) => void;
  addAgentMessage: (name: string, color: 'white' | 'black', text: string) => void;
  clear: () => void;
}

interface GameChatProps {
  onModeratorMessage?: (text: string) => void;
  onReset?: (fisher?: boolean) => void;
  onMoveWhite?: () => void;
  onMoveBlack?: () => void;
  thinkingColor?: ChessColor | null;
  activeColor?: ChessColor;
  gameOver?: boolean;
  autoPlay?: boolean;
  onAutoPlayChange?: (value: boolean) => void;
  fen?: string;
  sanMoves?: string[];
}

const LONG_PRESS_MS = 600;

export const GameChat = forwardRef<GameChatHandle, GameChatProps>(function GameChat({ onModeratorMessage, onReset, onMoveWhite, onMoveBlack, thinkingColor, activeColor, gameOver, autoPlay, onAutoPlayChange, fen, sanMoves }, ref) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const nextId = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const isThinking = thinkingColor != null;

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onReset?.(true);
    }, LONG_PRESS_MS);
  }, [onReset]);

  const handlePointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!didLongPress.current) {
      onReset?.();
    }
  }, [onReset]);

  const handlePointerLeave = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    addSystemMessage(text: string) {
      setMessages((prev) => [...prev, { id: ++nextId.current, role: 'system', text }]);
    },
    addAgentMessage(name: string, color: 'white' | 'black', text: string) {
      setMessages((prev) => [...prev, { id: ++nextId.current, role: color, text, sender: name }]);
    },
    clear() {
      setMessages([]);
    },
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: ++nextId.current, role: 'moderator', text },
    ]);
    onModeratorMessage?.(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="game-chat">
      <div className="game-chat__messages">
        {messages.length === 0 && (
          <div className="game-chat__empty">No messages yet</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`game-chat__message game-chat__message--${msg.role}`}>
            {msg.sender && (
              <span className="game-chat__sender">{msg.sender}</span>
            )}
            <div className="game-chat__bubble">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {onReset && (
        <div className="game-chat__controls">
          <button
            type="button"
            className="game-chat__ctrl-btn"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            Reset
          </button>
          {onMoveWhite && (
            <button
              type="button"
              className="game-chat__ctrl-btn"
              onClick={onMoveWhite}
              disabled={isThinking || !!gameOver || activeColor !== 'white'}
            >
              <ColorSpinner color="white" spinning={thinkingColor === 'white'} /> Move
            </button>
          )}
          {onMoveBlack && (
            <button
              type="button"
              className="game-chat__ctrl-btn"
              onClick={onMoveBlack}
              disabled={isThinking || !!gameOver || activeColor !== 'black'}
            >
              <ColorSpinner color="black" spinning={thinkingColor === 'black'} /> Move
            </button>
          )}
          {onAutoPlayChange && (
            <label className="game-chat__auto-label">
              <input
                type="checkbox"
                checked={!!autoPlay}
                onChange={(e) => onAutoPlayChange(e.target.checked)}
              />
              Auto
            </label>
          )}
          {fen && (
            <button
              type="button"
              className="game-chat__ctrl-btn"
              onClick={() => {
                setMessages((prev) => [...prev, { id: ++nextId.current, role: 'moderator', text: `FEN: ${fen}` }]);
                onModeratorMessage?.(`FEN: ${fen}`);
              }}
            >
              FEN
            </button>
          )}
          {sanMoves && sanMoves.length > 0 && (
            <button
              type="button"
              className="game-chat__ctrl-btn"
              onClick={() => {
                const text = `SAN Move history: ${sanMoves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(' ')}`;
                setMessages((prev) => [...prev, { id: ++nextId.current, role: 'moderator', text }]);
                onModeratorMessage?.(text);
              }}
            >
              SAN
            </button>
          )}
        </div>
      )}
      <div className="game-chat__input-row">
        <input
          className="game-chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
        <button
          className="game-chat__send"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
});
