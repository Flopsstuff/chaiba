import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { WhitePanel } from '../components/panels/WhitePanel';
import { Arena } from '../components/panels/Arena';
import { BlackPanel } from '../components/panels/BlackPanel';
import { ChessEngine } from '../chess/engine';
import type { GameState } from '../chess/types';
import type { GameChatHandle } from '../components/chat/GameChat';
import './Home.css';

const MOBILE_BREAKPOINT = 768;

export function Home() {
  const engineRef = useRef<ChessEngine>(new ChessEngine());
  const chatRef = useRef<GameChatHandle>(null);
  const [gameState, setGameState] = useState<GameState>(() => engineRef.current.getState());
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [whiteOpen, setWhiteOpen] = useState(false);
  const [blackOpen, setBlackOpen] = useState(false);

  const handleMove = useCallback((from: number, to: number) => {
    const engine = engineRef.current;
    const fileChar = (i: number) => String.fromCharCode(97 + (i % 8));
    const rankChar = (i: number) => String(Math.floor(i / 8) + 1);
    const uci = fileChar(from) + rankChar(from) + fileChar(to) + rankChar(to);

    const result = engine.moveUCI(uci);
    if (result.success) {
      setGameState(engine.getState());
      const san = engine.getSAN();
      setSanMoves(san);
      const lastMove = san[san.length - 1];
      const moveNum = Math.ceil(san.length / 2);
      const side = san.length % 2 === 1 ? 'White' : 'Black';
      chatRef.current?.addSystemMessage(`${moveNum}. ${side}: ${lastMove}`);
    } else {
      chatRef.current?.addSystemMessage(result.error);
    }
  }, []);

  const handleReset = useCallback((fisher?: boolean) => {
    engineRef.current.reset(fisher);
    const state = engineRef.current.getState();
    setGameState(state);
    const mode = fisher ? 'Chess960 (Fischer Random)' : 'Standard';
    const fen = engineRef.current.getFEN();
    setSanMoves([]);
    chatRef.current?.clear();
    chatRef.current?.addSystemMessage(`Game reset — Mode: ${mode} FEN: ${fen}`);
  }, []);

  useEffect(() => {
    handleReset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setWhiteOpen(!mobile);
      setBlackOpen(!mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const showWhite = whiteOpen;
  const showBlack = blackOpen;

  return (
    <>
      <Header onReset={handleReset} />
      <div className="home">
        <div className="toolbar">
          <button
            type="button"
            className={`toolbar__toggle ${showWhite ? 'toolbar__toggle--active' : ''}`}
            onClick={() => setWhiteOpen((v) => !v)}
            aria-label={showWhite ? 'Hide white panel' : 'Show white panel'}
          >
            {showWhite ? '◀ White' : '▶ White'}
          </button>
          <div className="toolbar__notation">
            {sanMoves.length === 0 && (
              <span className="toolbar__notation-empty">No moves yet</span>
            )}
            {sanMoves.map((move, i) => (
              <span key={i} className="toolbar__notation-move">
                {i % 2 === 0 && <span className="toolbar__notation-num">{Math.floor(i / 2) + 1}.</span>}
                {move}
              </span>
            ))}
          </div>
          <button
            type="button"
            className={`toolbar__toggle ${showBlack ? 'toolbar__toggle--active' : ''}`}
            onClick={() => setBlackOpen((v) => !v)}
            aria-label={showBlack ? 'Hide black panel' : 'Show black panel'}
          >
            {showBlack ? 'Black ▶' : 'Black ◀'}
          </button>
        </div>
        <div className="home__layout">
          <WhitePanel isOpen={showWhite} />
          <Arena ref={chatRef} gameState={gameState} onMove={handleMove} />
          <BlackPanel isOpen={showBlack} />
        </div>
      </div>
    </>
  );
}
