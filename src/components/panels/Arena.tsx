import { ChessBoard } from '../chess/ChessBoard';
import { GameChat } from '../chat/GameChat';
import './Arena.css';

export function Arena() {
  return (
    <main className="arena">
      <div className="arena__content">
        <ChessBoard />
      </div>
      <GameChat />
    </main>
  );
}
