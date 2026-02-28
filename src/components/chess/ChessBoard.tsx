import { DndContext, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useCallback, useState } from 'react';
import { getLegalMoves } from '../../chess/rules';
import type { GameState } from '../../chess/types';
import { ChessSquare } from './ChessSquare';
import './ChessBoard.css';

interface ChessBoardProps {
  gameState: GameState;
  onMove: (from: number, to: number) => void;
}

export function ChessBoard({ gameState, onMove }: ChessBoardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fromIndex = selectedIndex ?? (activeId != null ? parseInt(activeId, 10) : null);
  const validMoves = fromIndex != null && fromIndex >= 0 ? getLegalMoves(gameState, fromIndex) : [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  }, []);

  const handleSelect = useCallback((index: number) => {
    const piece = gameState.board[index];
    setSelectedIndex(piece ? index : null);
  }, [gameState.board]);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setSelectedIndex(null);
    if (!over) return;
    const from = parseInt(active.id as string, 10);
    const to = parseInt(over.id as string, 10);
    if (from !== to) onMove(from, to);
  }, [onMove]);

  // White at bottom: render rank 7 first (top), rank 0 last (bottom)
  const rows: number[][] = [];
  for (let r = 7; r >= 0; r--) {
    const row: number[] = [];
    for (let f = 0; f < 8; f++) row.push(r * 8 + f);
    rows.push(row);
  }

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="chess-board-wrap">
        <div className="chess-board__file-labels chess-board__file-labels--top">
          {files.map((f) => (
            <span key={f} className="chess-board__file-label">{f}</span>
          ))}
        </div>
        <div className="chess-board__body">
          <div className="chess-board__rank-labels">
            {ranks.map((r) => (
              <span key={r} className="chess-board__rank-label">{r}</span>
            ))}
          </div>
          <div className="chess-board">
            {rows.map((row, ri) => (
              <div key={ri} className="chess-board__row">
                {row.map((idx) => (
                  <ChessSquare
                    key={idx}
                    index={idx}
                    piece={gameState.board[idx]}
                    isHighlight={validMoves.includes(idx)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="chess-board__rank-labels">
            {ranks.map((r) => (
              <span key={r} className="chess-board__rank-label">{r}</span>
            ))}
          </div>
        </div>
        <div className="chess-board__file-labels chess-board__file-labels--bottom">
          {files.map((f) => (
            <span key={f} className="chess-board__file-label">{f}</span>
          ))}
        </div>
      </div>
    </DndContext>
  );
}
