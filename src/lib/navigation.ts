/**
 * Routes of the app and the "where was I" memory of this tab.
 *
 *   /            a new game being set up (not stored yet)
 *   /game/:id    a stored game
 *   /settings    settings
 */
const RETURN_PATH_STORAGE = 'return_path';

export const NEW_GAME_PATH = '/';

export function gamePath(id: string): string {
  return `/game/${id}`;
}

/** Remember the board this tab is showing, so Settings can lead back to it. */
export function setReturnPath(path: string): void {
  try {
    sessionStorage.setItem(RETURN_PATH_STORAGE, path);
  } catch { /* private mode: the default is used */ }
}

/** Where "Back" from Settings goes: the game this tab was showing, else a new game. */
export function getReturnPath(): string {
  try {
    return sessionStorage.getItem(RETURN_PATH_STORAGE) || NEW_GAME_PATH;
  } catch {
    return NEW_GAME_PATH;
  }
}
