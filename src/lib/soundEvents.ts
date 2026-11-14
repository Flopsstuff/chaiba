export type SoundEvent = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'game-end' | 'illegal';

/**
 * Pick the sound for a move that was just played, from its SAN.
 * The most significant thing about the move wins: the end of the game over
 * a check, a check over a promotion, and so on down to a plain move.
 */
export function soundForMove(san: string, gameOver = false): SoundEvent {
  if (gameOver || san.endsWith('#')) return 'game-end';
  if (san.endsWith('+')) return 'check';
  if (san.includes('=')) return 'promote';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return 'move';
}
