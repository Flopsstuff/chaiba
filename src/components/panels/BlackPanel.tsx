import './BlackPanel.css';

interface BlackPanelProps {
  isOpen: boolean;
}

export function BlackPanel({ isOpen }: BlackPanelProps) {
  return (
    <aside className={`black-panel ${isOpen ? 'black-panel--open' : ''}`}>
      <div className="black-panel__content">
        <h3>BLACK</h3>
        {/* TODO: Black side implementation */}
      </div>
    </aside>
  );
}
