import { Link } from 'react-router-dom';
import { GitHubLogo } from './GitHubLogo';
import './Header.css';

interface HeaderProps {
  showBack?: boolean;
  totalCost?: number;
}

export function Header({ showBack, totalCost }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <GitHubLogo />
        <Link to="/" className="header-logo">CHAIBA</Link>
      </div>
      {(totalCost ?? 0) > 0 && (
        <span className="header-cost">${totalCost!.toFixed(4)}</span>
      )}
      <div className="header-actions">
        {showBack ? (
          <Link to="/" className="header-back">← Back</Link>
        ) : (
          <Link to="/settings" className="header-settings">Settings</Link>
        )}
      </div>
    </header>
  );
}
