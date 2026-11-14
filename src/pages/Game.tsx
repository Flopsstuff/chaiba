import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { ChessEngine } from '../chess/engine';
import { NEW_GAME_PATH, gamePath, setReturnPath } from '../lib/navigation';
import { createSession, openSession } from '../lib/session';
import type { GameSession, SessionMeta, SessionPlayer } from '../lib/session';
import { claimSession, listHeldSessions } from '../lib/sessionLock';
import type { SessionClaim } from '../lib/sessionLock';
import { getSession, listSessions } from '../lib/sessionStore';
import type { ChessColor } from '../types';
import { Home } from './Home';
import type { PlayerDefaults } from './Home';
import './Game.css';

type Board = { session: GameSession; engine: ChessEngine; stored: boolean };

type View =
  | { kind: 'loading' }
  | { kind: 'board'; key: string; board: Board; defaults?: Record<ChessColor, PlayerDefaults> }
  /** The game is open in another tab. */
  | { kind: 'busy'; id: string }
  | { kind: 'missing'; id: string }
  | { kind: 'error'; id: string; message: string };

/** A blank game: nothing is stored until its first move or message. */
function newBoard(fischer: boolean): Board {
  const engine = new ChessEngine();
  engine.reset(fischer);
  const blank = (): SessionPlayer => ({ id: '', name: '', model: '', basePrompt: '', customPrompt: '' });
  const session = createSession({
    mode: fischer ? 'chess960' : 'standard',
    initialFen: engine.getFEN(),
    players: { white: blank(), black: blank() },
  });
  return { session, engine, stored: false };
}

// The offer to continue the last game is made once per page load, not on every new game.
let continueOffered = false;

/**
 * Decides which game this tab shows and owns it while it is shown:
 * `/` is a new game being set up, `/game/:id` a stored one.
 */
export function Game() {
  const routeId = useMatch('/game/:id')?.params.id;
  const navigate = useNavigate();
  const [view, setView] = useState<View>(() => routeId
    ? { kind: 'loading' }
    : { kind: 'board', key: 'new-0', board: newBoard(false) });
  const [frozen, setFrozen] = useState(false);
  const [offer, setOffer] = useState<SessionMeta | null>(null);
  /** Id of the stored game on the board, once this tab owns it. */
  const liveIdRef = useRef<string | null>(null);
  /** True while the board is a new game that has not started. */
  const settingUpRef = useRef(!routeId);
  const claimRef = useRef<SessionClaim | null>(null);
  const loadSeqRef = useRef(0);
  const boardSeqRef = useRef(0);

  const releaseClaim = useCallback(() => {
    claimRef.current?.release();
    claimRef.current = null;
  }, []);

  const showNewGame = useCallback((fischer = false, defaults?: Record<ChessColor, PlayerDefaults>) => {
    loadSeqRef.current++;
    releaseClaim();
    liveIdRef.current = null;
    settingUpRef.current = true;
    setFrozen(false);
    setOffer(null);
    setReturnPath(NEW_GAME_PATH);
    setView({ kind: 'board', key: `new-${++boardSeqRef.current}`, board: newBoard(fischer), defaults });
  }, [releaseClaim]);

  const load = useCallback(async (id: string, takeOver: boolean) => {
    const seq = ++loadSeqRef.current;
    const isCurrent = () => loadSeqRef.current === seq;
    releaseClaim();
    liveIdRef.current = null;
    settingUpRef.current = false;
    setFrozen(false);
    setOffer(null);
    setView({ kind: 'loading' });

    const claim = await claimSession(id, {
      takeOver,
      onLost: () => {
        if (liveIdRef.current === id) setFrozen(true);
      },
    });
    if (!isCurrent()) {
      claim?.release();
      return;
    }
    if (!claim) {
      setView({ kind: 'busy', id });
      return;
    }
    try {
      const data = await getSession(id);
      if (!isCurrent()) {
        claim.release();
        return;
      }
      if (!data) {
        claim.release();
        setView({ kind: 'missing', id });
        return;
      }
      const opened = openSession(data);
      claimRef.current = claim;
      liveIdRef.current = id;
      setReturnPath(gamePath(id));
      setView({ kind: 'board', key: `game-${id}-${seq}`, board: { ...opened, stored: true } });
    } catch (err) {
      claim.release();
      if (isCurrent()) setView({ kind: 'error', id, message: err instanceof Error ? err.message : String(err) });
    }
  }, [releaseClaim]);

  // Follow the address: another game id loads that game, no id means a new game.
  useEffect(() => {
    if (routeId) {
      // The game that has just started on this board already is the one in the address.
      if (liveIdRef.current !== routeId) load(routeId, false);
    } else if (!settingUpRef.current) {
      showNewGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  useEffect(() => releaseClaim, [releaseClaim]);

  // A page kept in the browser's back/forward cache would go on holding its
  // game. Let go when the page is hidden for good, and start over if it is
  // brought back from that cache.
  useEffect(() => {
    const onHide = () => releaseClaim();
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
    };
  }, [releaseClaim]);

  // On arriving at a new game, offer the last unfinished one that no tab has open.
  useEffect(() => {
    if (routeId || continueOffered) return;
    let cancelled = false;
    Promise.all([listSessions(), listHeldSessions()])
      .then(([sessions, held]) => {
        // Effects run twice in development; only the run that survives counts.
        if (cancelled) return;
        continueOffered = true;
        const last = sessions.find((s) => s.status === 'in-progress' && !held.includes(s.id));
        if (last && settingUpRef.current) setOffer(last);
      })
      .catch(() => { /* no offer; the games list still works */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The new game on the board made its first move: it gets its id in the address. */
  const handleStarted = useCallback((session: GameSession) => {
    const id = session.id;
    settingUpRef.current = false;
    liveIdRef.current = id;
    setOffer(null);
    setReturnPath(gamePath(id));
    navigate(gamePath(id), { replace: true });
    claimSession(id, {
      onLost: () => {
        if (liveIdRef.current === id) setFrozen(true);
      },
    }).then((claim) => {
      if (liveIdRef.current === id) claimRef.current = claim;
      else claim?.release();
    });
  }, [navigate]);

  const handleNewGame = useCallback((fischer: boolean, players: GameSession['players']) => {
    const keep = (p: SessionPlayer): PlayerDefaults => ({ model: p.model, modelName: p.modelName, customPrompt: p.customPrompt });
    showNewGame(fischer, { white: keep(players.white), black: keep(players.black) });
    navigate(NEW_GAME_PATH);
  }, [showNewGame, navigate]);

  if (view.kind === 'board') {
    const id = liveIdRef.current;
    return (
      <>
        <Home
          key={view.key}
          initial={view.board}
          defaults={view.defaults}
          frozen={frozen}
          onStarted={handleStarted}
          onNewGame={handleNewGame}
        />
        {offer && (
          <div className="game-notice" role="status">
            <span className="game-notice__text">
              Unfinished game: {offer.white.name} vs {offer.black.name}, move {Math.floor(offer.plies / 2) + 1}
            </span>
            <button type="button" className="game-notice__button game-notice__button--primary" onClick={() => navigate(gamePath(offer.id))}>
              Continue
            </button>
            <button type="button" className="game-notice__button" onClick={() => setOffer(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {frozen && id && (
          <div className="game-overlay">
            <div className="game-card" role="alertdialog" aria-label="Game taken over">
              <h2>This game moved to another tab</h2>
              <p>It was taken over there, so this tab has stopped playing and saving it.</p>
              <div className="game-card__buttons">
                <button type="button" className="game-card__button game-card__button--primary" onClick={() => load(id, true)}>
                  Take it back here
                </button>
                <button type="button" className="game-card__button" onClick={() => navigate(NEW_GAME_PATH)}>
                  New game
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="game-screen">
        {view.kind === 'loading' && <p className="game-screen__loading">Loading game…</p>}
        {view.kind === 'busy' && (
          <div className="game-card">
            <h2>This game is open in another tab</h2>
            <p>A game can be played in one tab at a time. Taking it over stops it in the other tab.</p>
            <div className="game-card__buttons">
              <button type="button" className="game-card__button game-card__button--primary" onClick={() => load(view.id, true)}>
                Take it over here
              </button>
              <button type="button" className="game-card__button" onClick={() => navigate(NEW_GAME_PATH)}>
                New game
              </button>
            </div>
          </div>
        )}
        {view.kind === 'missing' && (
          <div className="game-card">
            <h2>Game not found</h2>
            <p>There is no saved game with this address in this browser. It may have been deleted, or saved in another browser.</p>
            <div className="game-card__buttons">
              <button type="button" className="game-card__button game-card__button--primary" onClick={() => navigate(NEW_GAME_PATH)}>
                New game
              </button>
            </div>
          </div>
        )}
        {view.kind === 'error' && (
          <div className="game-card">
            <h2>This game could not be opened</h2>
            <p>{view.message}</p>
            <div className="game-card__buttons">
              <button type="button" className="game-card__button game-card__button--primary" onClick={() => load(view.id, false)}>
                Try again
              </button>
              <button type="button" className="game-card__button" onClick={() => navigate(NEW_GAME_PATH)}>
                New game
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
