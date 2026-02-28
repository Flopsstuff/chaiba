import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
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
}

export const GameChat = forwardRef<GameChatHandle, GameChatProps>(function GameChat({ onModeratorMessage }, ref) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    addSystemMessage(text: string) {
      setMessages((prev) => [...prev, { id: Date.now(), role: 'system', text }]);
    },
    addAgentMessage(name: string, color: 'white' | 'black', text: string) {
      setMessages((prev) => [...prev, { id: Date.now(), role: color, text, sender: name }]);
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
      { id: Date.now(), role: 'moderator', text },
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
