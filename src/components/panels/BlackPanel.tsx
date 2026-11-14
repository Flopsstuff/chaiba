import { forwardRef } from 'react';
import { AgentCard, AgentCardHandle } from './AgentCard';
import { ChessColor, Message } from '../../types';
import type { SessionPlayer } from '../../lib/session';
import './BlackPanel.css';

interface BlackPanelProps {
  isOpen: boolean;
  messages: Message[];
  fischer960?: boolean;
  restored?: SessionPlayer | null;
  defaults?: Pick<SessionPlayer, 'model' | 'modelName' | 'customPrompt'>;
  onSetupChange?: (color: ChessColor, setup: SessionPlayer) => void;
}

export const BlackPanel = forwardRef<AgentCardHandle, BlackPanelProps>(
  function BlackPanel({ isOpen, messages, fischer960, restored, defaults, onSetupChange }, ref) {
    return (
      <aside className={`black-panel ${isOpen ? 'black-panel--open' : ''}`}>
        <div className="black-panel__content">
          <AgentCard ref={ref} color="black" messages={messages} fischer960={fischer960} restored={restored} defaults={defaults} onSetupChange={onSetupChange} />
        </div>
      </aside>
    );
  }
);
