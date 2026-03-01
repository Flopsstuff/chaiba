import { forwardRef } from 'react';
import { ChessBoard } from '../chess/ChessBoard';
import { GameChat, type GameChatHandle } from '../chat/GameChat';
import type { GameState } from '../../chess/types';
import type { ChessColor } from '../../types';
import './Arena.css';

interface ArenaProps {
  gameState: GameState;
  lastMove?: { from: number; to: number } | null;
  onMove: (from: number, to: number) => void;
  onModeratorMessage?: (text: string) => void;
  onReset?: (fisher?: boolean) => void;
  onMoveWhite?: () => void;
  onMoveBlack?: () => void;
  thinkingColor?: ChessColor | null;
  activeColor?: ChessColor;
  gameOver?: boolean;
  autoPlay?: boolean;
  onAutoPlayChange?: (value: boolean) => void;
}

export const Arena = forwardRef<GameChatHandle, ArenaProps>(function Arena({ gameState, lastMove, onMove, onModeratorMessage, onReset, onMoveWhite, onMoveBlack, thinkingColor, activeColor, gameOver, autoPlay, onAutoPlayChange }, ref) {
  return (
    <main className="arena">
      <div className="arena__content">
        <ChessBoard gameState={gameState} lastMove={lastMove} onMove={onMove} />
      </div>
      <GameChat
        ref={ref}
        onModeratorMessage={onModeratorMessage}
        onReset={onReset}
        onMoveWhite={onMoveWhite}
        onMoveBlack={onMoveBlack}
        thinkingColor={thinkingColor}
        activeColor={activeColor}
        gameOver={gameOver}
        autoPlay={autoPlay}
        onAutoPlayChange={onAutoPlayChange}
      />
    </main>
  );
});
