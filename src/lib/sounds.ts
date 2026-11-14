/**
 * Game sounds. The on/off preference is stored in localStorage under
 * 'sound_enabled' (on unless explicitly turned off).
 *
 * The "wood" set is the one in use. A second set, "glass", sits next to it in
 * src/assets/sounds/ with the same file names and is not wired up.
 */
import moveUrl from '../assets/sounds/wood/move.wav';
import captureUrl from '../assets/sounds/wood/capture.wav';
import castleUrl from '../assets/sounds/wood/castle.wav';
import checkUrl from '../assets/sounds/wood/check.wav';
import promoteUrl from '../assets/sounds/wood/promote.wav';
import gameEndUrl from '../assets/sounds/wood/game-end.wav';
import illegalUrl from '../assets/sounds/wood/illegal.wav';
import type { SoundEvent } from './soundEvents';

const SOUND_STORAGE = 'sound_enabled';

const URLS: Record<SoundEvent, string> = {
  move: moveUrl,
  capture: captureUrl,
  castle: castleUrl,
  check: checkUrl,
  promote: promoteUrl,
  'game-end': gameEndUrl,
  illegal: illegalUrl,
};

const cache = new Map<SoundEvent, HTMLAudioElement>();

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_STORAGE) !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_STORAGE, String(enabled));
}

export function playSound(event: SoundEvent): void {
  if (!isSoundEnabled()) return;
  let audio = cache.get(event);
  if (!audio) {
    audio = new Audio(URLS[event]);
    cache.set(event, audio);
  }
  audio.currentTime = 0;
  // The browser rejects playback until the user has interacted with the page.
  audio.play().catch(() => {});
}
