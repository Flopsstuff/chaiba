import type { ChessColor } from '../types';
import './ColorSpinner.css';

interface ColorSpinnerProps {
  color: ChessColor;
  spinning?: boolean;
}

export function ColorSpinner({ color, spinning }: ColorSpinnerProps) {
  return (
    <span className="color-spinner">
      {color === 'white' ? '⚪' : '⚫'}
      {spinning && <span className="color-spinner__ring" />}
    </span>
  );
}
