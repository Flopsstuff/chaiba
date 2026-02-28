import { forwardRef } from 'react';
import { ChessBoard } from '../chess/ChessBoard';
import { GameChat, type GameChatHandle } from '../chat/GameChat';
import type { GameState } from '../../chess/types';
import './Arena.css';

interface ArenaProps {
  gameState: GameState;
  onMove: (from: number, to: number) => void;
}

export const Arena = forwardRef<GameChatHandle, ArenaProps>(function Arena({ gameState, onMove }, ref) {
  return (
    <main className="arena">
      <div className="arena__content">
        <ChessBoard gameState={gameState} onMove={onMove} />
      </div>
      <GameChat ref={ref} />
    </main>
  );
});
