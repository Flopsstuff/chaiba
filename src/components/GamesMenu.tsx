import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { SessionMeta } from '../lib/session';
import { listSessions, subscribeSessions } from '../lib/sessionStore';
import { listHeldSessions } from '../lib/sessionLock';
import { NEW_GAME_PATH, gamePath } from '../lib/navigation';
import './GamesMenu.css';

interface GamesMenuProps {
  /** The stored game this tab is showing, if any. */
  currentId?: string;
}

/** Result in score notation; '*' is the PGN marker for a game still going. */
function outcome(game: SessionMeta): { label: string; title: string } {
  if (game.status !== 'finished') return { label: '*', title: 'In progress' };
  if (game.winner === 'white') return { label: '1-0', title: 'White won' };
  if (game.winner === 'black') return { label: '0-1', title: 'Black won' };
  return { label: '½-½', title: 'Draw' };
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function moveCount(plies: number): string {
  const moves = Math.ceil(plies / 2);
  return `${moves} ${moves === 1 ? 'move' : 'moves'}`;
}

export function GamesMenu({ currentId }: GamesMenuProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionMeta[] | null>(null);
  const [held, setHeld] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let latest = 0;

    const load = () => {
      const request = ++latest;
      // The list is still useful when the lock state cannot be read.
      Promise.all([listSessions(), listHeldSessions().catch(() => [] as string[])])
        .then(([list, heldIds]) => {
          if (cancelled || request !== latest) return;
          setSessions(list);
          setHeld(heldIds);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled || request !== latest) return;
          setError(`Could not load games: ${err instanceof Error ? err.message : String(err)}`);
        });
    };

    load();
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeSessions(load);
    } catch {
      // Without live updates the list is simply as of the moment the menu opened.
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /** Arrow keys walk through the items, as expected of a menu. */
  const handleArrows = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('a[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = index === -1
      ? (step === 1 ? 0 : items.length - 1)
      : (index + step + items.length) % items.length;
    items[next].focus();
  };

  const close = () => setOpen(false);

  return (
    <div className="games-menu" ref={rootRef} onKeyDown={handleArrows}>
      <button
        ref={buttonRef}
        type="button"
        className={`games-menu__button ${open ? 'games-menu__button--open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Games ▾
      </button>
      {open && (
        <div className="games-menu__panel" role="menu" aria-label="Games">
          <Link
            to={NEW_GAME_PATH}
            role="menuitem"
            className="games-menu__item games-menu__item--new"
            onClick={close}
          >
            + New game
          </Link>

          {error && <div className="games-menu__note games-menu__note--error">{error}</div>}
          {!error && sessions === null && <div className="games-menu__note">Loading…</div>}
          {!error && sessions?.length === 0 && (
            <div className="games-menu__note">No saved games yet.</div>
          )}

          {sessions?.map((game) => {
            const result = outcome(game);
            const isCurrent = game.id === currentId;
            const content = (
              <>
                <span
                  className={`games-menu__status games-menu__status--${game.status}`}
                  title={result.title}
                  aria-label={result.title}
                >
                  {result.label}
                </span>
                <span className="games-menu__main">
                  <span className="games-menu__players">
                    {game.white.name} vs {game.black.name}
                  </span>
                  <span className="games-menu__details">
                    {moveCount(game.plies)} · {shortDate(game.updatedAt)}
                    {isCurrent && <span className="games-menu__tag games-menu__tag--current">this game</span>}
                    {!isCurrent && held.includes(game.id) && (
                      <span className="games-menu__tag">open in another tab</span>
                    )}
                  </span>
                </span>
              </>
            );
            return isCurrent ? (
              <div
                key={game.id}
                role="menuitem"
                aria-disabled="true"
                aria-current="page"
                className="games-menu__item games-menu__item--current"
              >
                {content}
              </div>
            ) : (
              <Link
                key={game.id}
                to={gamePath(game.id)}
                role="menuitem"
                className="games-menu__item"
                onClick={close}
              >
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
