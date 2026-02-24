import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Piece } from '../../chess/types';

// Use black symbols (filled) for both; color via CSS
const SYMBOLS: Record<string, string> = {
  king: '♚',
  queen: '♛',
  rook: '♜',
  bishop: '♝',
  knight: '♞',
  pawn: '♟',
};

interface ChessPieceProps {
  piece: Piece;
  index: number;
}

export function ChessPiece({ piece, index }: ChessPieceProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(index) });
  const symbolKey = piece.type;
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <span
      ref={setNodeRef}
      className={`chess-piece chess-piece--${piece.color} ${isDragging ? 'chess-piece--dragging' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      {SYMBOLS[symbolKey]}
    </span>
  );
}
