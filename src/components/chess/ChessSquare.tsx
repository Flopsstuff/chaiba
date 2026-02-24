import { useDroppable } from '@dnd-kit/core';
import type { Piece } from '../../chess/types';
import { ChessPiece } from './ChessPiece';

interface ChessSquareProps {
  index: number;
  piece: Piece | null;
  isHighlight: boolean;
  onSelect?: (index: number) => void;
}

export function ChessSquare({ index, piece, isHighlight, onSelect }: ChessSquareProps) {
  const { isOver, setNodeRef } = useDroppable({ id: String(index) });
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const isLight = (file + rank) % 2 === 0;

  return (
    <div
      ref={setNodeRef}
      className={`chess-square ${isLight ? 'chess-square--light' : 'chess-square--dark'} ${isHighlight ? 'chess-square--highlight' : ''} ${isOver ? 'chess-square--over' : ''}`}
      data-index={index}
      onClick={() => onSelect?.(index)}
      role="button"
      tabIndex={0}
    >
      {piece && <ChessPiece piece={piece} index={index} />}
    </div>
  );
}
