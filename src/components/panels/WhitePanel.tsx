import { AgentCard } from './AgentCard';
import './WhitePanel.css';

interface WhitePanelProps {
  isOpen: boolean;
}

export function WhitePanel({ isOpen }: WhitePanelProps) {
  return (
    <aside className={`white-panel ${isOpen ? 'white-panel--open' : ''}`}>
      <div className="white-panel__content">
        <AgentCard color="white" />
      </div>
    </aside>
  );
}
