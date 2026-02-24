import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { WhitePanel } from '../components/panels/WhitePanel';
import { Arena } from '../components/panels/Arena';
import { BlackPanel } from '../components/panels/BlackPanel';
import './Home.css';

const MOBILE_BREAKPOINT = 768;

export function Home() {
  const [whiteOpen, setWhiteOpen] = useState(false);
  const [blackOpen, setBlackOpen] = useState(false);

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
      <Header />
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
            {/* game notation will go here */}
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
          <Arena />
          <BlackPanel isOpen={showBlack} />
        </div>
      </div>
    </>
  );
}
