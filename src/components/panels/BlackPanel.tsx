import { forwardRef } from 'react';
import { AgentCard, AgentCardHandle } from './AgentCard';
import { Message } from '../../types';
import './BlackPanel.css';

interface BlackPanelProps {
  isOpen: boolean;
  messages: Message[];
}

export const BlackPanel = forwardRef<AgentCardHandle, BlackPanelProps>(
  function BlackPanel({ isOpen, messages }, ref) {
    return (
      <aside className={`black-panel ${isOpen ? 'black-panel--open' : ''}`}>
        <div className="black-panel__content">
          <AgentCard ref={ref} color="black" messages={messages} />
        </div>
      </aside>
    );
  }
);
