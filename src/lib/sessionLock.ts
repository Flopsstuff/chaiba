/**
 * Which tab owns which game.
 *
 * A tab that has a game open holds a Web Lock named after the session, so two
 * tabs cannot write the same game. Another tab can take the game over: the
 * lock is stolen, and the previous owner is told through `onLost`.
 *
 * Without the Web Locks API (very old browsers, insecure origins) every claim
 * succeeds and nothing is reported as held.
 */
const PREFIX = 'chaiba-session:';

export interface SessionClaim {
  /** Give the game up, e.g. when leaving it. Safe to call more than once. */
  release(): void;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function request(id: string, steal: boolean, onLost: () => void): Promise<SessionClaim | null> {
  return new Promise((resolve) => {
    let release = () => {};
    let released = false;
    const held = new Promise<void>((done) => { release = done; });
    navigator.locks
      .request(PREFIX + id, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        resolve({ release: () => { released = true; release(); } });
        return held;
      })
      .catch(() => {
        // The lock was stolen by another tab (or the request itself failed).
        if (!released) onLost();
        resolve(null);
      });
  });
}

/**
 * Become the owner of a session. Resolves to null if another tab owns it and
 * `takeOver` is not set. `onLost` is called if another tab takes it over later.
 */
export async function claimSession(
  id: string,
  options: { takeOver?: boolean; onLost: () => void },
): Promise<SessionClaim | null> {
  if (!navigator.locks) return { release: () => {} };
  if (options.takeOver) return request(id, true, options.onLost);
  // A lock this tab has just released may take a moment to become free.
  for (let attempt = 0; attempt < 4; attempt++) {
    const claim = await request(id, false, options.onLost);
    if (claim) return claim;
    await pause(60);
  }
  return null;
}

/** Ids of the sessions currently open in some tab, this one included. */
export async function listHeldSessions(): Promise<string[]> {
  if (!navigator.locks) return [];
  const state = await navigator.locks.query();
  return (state.held ?? [])
    .map((lock) => lock.name ?? '')
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => name.slice(PREFIX.length));
}
