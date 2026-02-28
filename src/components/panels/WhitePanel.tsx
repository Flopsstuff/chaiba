import { forwardRef } from 'react';
import { AgentCard, AgentCardHandle } from './AgentCard';
import { Message } from '../../types';
import './WhitePanel.css';

interface WhitePanelProps {
  isOpen: boolean;
  messages: Message[];
}

export const WhitePanel = forwardRef<AgentCardHandle, WhitePanelProps>(
  function WhitePanel({ isOpen, messages }, ref) {
    return (
      <aside className={`white-panel ${isOpen ? 'white-panel--open' : ''}`}>
        <div className="white-panel__content">
          <AgentCard ref={ref} color="white" messages={messages} />
        </div>
      </aside>
    );
  }
);
