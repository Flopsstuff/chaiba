import { soundForMove } from './soundEvents';

describe('soundForMove', () => {
  it.each([
    ['e4', 'move'],
    ['Nf3', 'move'],
    ['Nxd4', 'capture'],
    ['exd5', 'capture'],
    ['O-O', 'castle'],
    ['O-O-O', 'castle'],
    ['e8=Q', 'promote'],
    ['dxe8=N', 'promote'],
    ['Bb5+', 'check'],
    ['Qxf7+', 'check'],
    ['O-O+', 'check'],
    ['e8=Q+', 'check'],
    ['Qxf7#', 'game-end'],
    ['O-O-O#', 'game-end'],
  ])('%s -> %s', (san, expected) => {
    expect(soundForMove(san)).toBe(expected);
  });

  it('plays the end-of-game sound for a move that ends the game without mate', () => {
    expect(soundForMove('Qb6', true)).toBe('game-end');
  });
});
