import { useMemo } from 'react';
import { useChessPlayer } from '../../hooks/useChessPlayer';
import { ChessPrompts } from '../../agents/ChessPrompts';
import { getSelectedModel } from '../../lib/models';
import { MessageBubble } from './MessageBubble';
import './BlackPanel.css';

interface BlackPanelProps {
  isOpen: boolean;
}

export function BlackPanel({ isOpen }: BlackPanelProps) {
  const config = useMemo(() => ({
    name: 'Black',
    color: 'black' as const,
    model: getSelectedModel(1),
    systemPrompt: ChessPrompts.getSystemPrompt('black'),
  }), []);

  const { messages, status, error } = useChessPlayer(config);

  return (
    <aside className={`black-panel ${isOpen ? 'black-panel--open' : ''}`}>
      <div className="black-panel__content">
        <h3>
          BLACK
          {status === 'thinking' && <span className="panel-status panel-status--thinking"> ...</span>}
          {status === 'error' && <span className="panel-status panel-status--error"> !</span>}
        </h3>
        {error && <div className="panel-error">{error}</div>}
        <div className="panel-messages">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} playerLabel="Black" />
          ))}
        </div>
      </div>
    </aside>
  );
}
