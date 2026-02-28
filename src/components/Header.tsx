import { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GitHubLogo } from './GitHubLogo';
import './Header.css';

const LONG_PRESS_MS = 600;

interface HeaderProps {
  showBack?: boolean;
  onReset?: (fisher?: boolean) => void;
}

export function Header({ showBack, onReset }: HeaderProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onReset?.(true);
    }, LONG_PRESS_MS);
  }, [onReset]);

  const handlePointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!didLongPress.current) {
      onReset?.();
    }
  }, [onReset]);

  const handlePointerLeave = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <GitHubLogo />
        <Link to="/" className="header-logo">CHAIBA</Link>
      </div>
      {onReset && (
        <div className="header-controls">
          <button
            type="button"
            className="header-controls__btn"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            Reset
          </button>
        </div>
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
