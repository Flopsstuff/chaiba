import { useMemo } from 'react';
import { useChessPlayer } from '../../hooks/useChessPlayer';
import { ChessPrompts } from '../../agents/ChessPrompts';
import { getSelectedModel } from '../../lib/models';
import { MessageBubble } from './MessageBubble';
import './WhitePanel.css';

interface WhitePanelProps {
  isOpen: boolean;
}

export function WhitePanel({ isOpen }: WhitePanelProps) {
  const config = useMemo(() => ({
    name: 'White',
    color: 'white' as const,
    model: getSelectedModel(0),
    systemPrompt: ChessPrompts.getSystemPrompt('white'),
  }), []);

  const { messages, status, error } = useChessPlayer(config);

  return (
    <aside className={`white-panel ${isOpen ? 'white-panel--open' : ''}`}>
      <div className="white-panel__content">
        <h3>
          WHITE
          {status === 'thinking' && <span className="panel-status panel-status--thinking"> ...</span>}
          {status === 'error' && <span className="panel-status panel-status--error"> !</span>}
        </h3>
        {error && <div className="panel-error">{error}</div>}
        <div className="panel-messages">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} playerLabel="White" />
          ))}
        </div>
      </div>
    </aside>
  );
}
