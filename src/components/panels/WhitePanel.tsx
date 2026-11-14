import { forwardRef } from 'react';
import { AgentCard, AgentCardHandle } from './AgentCard';
import { ChessColor, Message } from '../../types';
import type { SessionPlayer } from '../../lib/session';
import './WhitePanel.css';

interface WhitePanelProps {
  isOpen: boolean;
  messages: Message[];
  fischer960?: boolean;
  restored?: SessionPlayer | null;
  defaults?: Pick<SessionPlayer, 'model' | 'modelName' | 'customPrompt'>;
  onSetupChange?: (color: ChessColor, setup: SessionPlayer) => void;
}

export const WhitePanel = forwardRef<AgentCardHandle, WhitePanelProps>(
  function WhitePanel({ isOpen, messages, fischer960, restored, defaults, onSetupChange }, ref) {
    return (
      <aside className={`white-panel ${isOpen ? 'white-panel--open' : ''}`}>
        <div className="white-panel__content">
          <AgentCard ref={ref} color="white" messages={messages} fischer960={fischer960} restored={restored} defaults={defaults} onSetupChange={onSetupChange} />
        </div>
      </aside>
    );
  }
);
