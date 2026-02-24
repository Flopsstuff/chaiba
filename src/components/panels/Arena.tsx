import { ChessBoard } from '../chess/ChessBoard';
import './Arena.css';

export function Arena() {
  return (
    <main className="arena">
      <div className="arena__content">
        <h3>ARENA</h3>
        <ChessBoard />
      </div>
    </main>
  );
}
