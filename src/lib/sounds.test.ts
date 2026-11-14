import { isSoundEnabled, playSound, setSoundEnabled } from './sounds';

describe('sounds', () => {
  let store: Record<string, string>;
  let played: string[];

  beforeEach(() => {
    store = {};
    played = [];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    });
    vi.stubGlobal('Audio', class {
      currentTime = 0;
      constructor(public src: string) {}
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('is enabled until turned off, and remembers the choice', () => {
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it('plays a different file for each event', () => {
    playSound('move');
    playSound('capture');
    expect(played).toHaveLength(2);
    expect(played[0]).toMatch(/move/);
    expect(played[1]).toMatch(/capture/);
  });

  it('stays silent when muted', () => {
    setSoundEnabled(false);
    playSound('move');
    expect(played).toEqual([]);
  });
});
