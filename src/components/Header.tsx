import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitHubLogo } from './GitHubLogo';
import { GamesMenu } from './GamesMenu';
import { getReturnPath } from '../lib/navigation';
import { isSoundEnabled, playSound, setSoundEnabled } from '../lib/sounds';
import './Header.css';

interface HeaderProps {
  showBack?: boolean;
  totalCost?: number;
  /** The stored game this page is showing; highlighted in the games menu. */
  gameId?: string;
}

export function Header({ showBack, totalCost, gameId }: HeaderProps) {
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    // Confirms the choice audibly and unlocks audio playback in the browser.
    if (next) playSound('move');
  };

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
        <GamesMenu currentId={gameId} />
        <button
          type="button"
          className={`header-sound ${soundOn ? 'header-sound--on' : ''}`}
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={soundOn ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
        >
          {soundOn ? '🔊' : '🔇'}
          <span className="header-sound__label">{soundOn ? ' Sound' : ' Muted'}</span>
        </button>
        {showBack ? (
          <Link to={getReturnPath()} className="header-back">← Back</Link>
        ) : (
          <Link to="/settings" className="header-settings">Settings</Link>
        )}
      </div>
    </header>
  );
}
