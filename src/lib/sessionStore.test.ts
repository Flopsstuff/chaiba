import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createSession, sessionMeta } from './session';
import type { GameSession } from './session';
import {
  closeSessionStore,
  createSessionWriter,
  deleteFinishedSessions,
  deleteSession,
  getSession,
  listSessions,
  putSession,
  subscribeSessions,
} from './sessionStore';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A session with a fixed id and timestamp, so that order and identity are predictable. */
function makeSession(id: string, updatedAt = '2026-01-01T00:00:00.000Z', over: Partial<GameSession> = {}): GameSession {
  const session = createSession({
    mode: 'standard',
    initialFen: START_FEN,
    players: {
      white: { id: 'w-1', name: 'Tal', model: 'a/white', basePrompt: 'base white', customPrompt: '' },
      black: { id: 'b-1', name: 'Anand', model: 'b/black', basePrompt: 'base black', customPrompt: '' },
    },
  });
  return { ...session, id, createdAt: updatedAt, updatedAt, ...over };
}

function finished(id: string, updatedAt?: string): GameSession {
  return makeSession(id, updatedAt, { status: 'finished', result: { reason: 'checkmate', winner: 'white' } });
}

/** The raw contents of one object store, read without going through the module. */
function readStore(name: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('chaiba');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction(name, 'readonly').objectStore(name).getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
    };
  });
}

describe('sessionStore', () => {
  beforeEach(() => {
    closeSessionStore();
    globalThis.indexedDB = new IDBFactory();
  });

  describe('sessions', () => {
    it('stores a session and reads it back', async () => {
      const session = makeSession('a');
      session.chat.push({ at: session.createdAt, role: 'system', text: 'Game started' });
      await putSession(session);
      expect(await getSession('a')).toEqual(session);
    });

    it('returns null for a missing id', async () => {
      await putSession(makeSession('a'));
      expect(await getSession('nope')).toBeNull();
    });

    it('lists meta only, most recently updated first', async () => {
      const old = makeSession('old', '2026-01-01T00:00:00.000Z');
      const newest = makeSession('newest', '2026-03-01T00:00:00.000Z');
      const middle = makeSession('middle', '2026-02-01T00:00:00.000Z');
      await putSession(old);
      await putSession(newest);
      await putSession(middle);

      const list = await listSessions();
      expect(list.map((m) => m.id)).toEqual(['newest', 'middle', 'old']);
      expect(list).toEqual([sessionMeta(newest), sessionMeta(middle), sessionMeta(old)]);
      expect(list[0]).not.toHaveProperty('moves');
    });

    it('lists nothing in an empty database', async () => {
      expect(await listSessions()).toEqual([]);
    });

    it('replaces a session with the same id and updates its meta', async () => {
      await putSession(makeSession('a'));
      const later = finished('a', '2026-05-01T00:00:00.000Z');
      await putSession(later);

      expect(await getSession('a')).toEqual(later);
      const list = await listSessions();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: 'a', status: 'finished', winner: 'white', updatedAt: '2026-05-01T00:00:00.000Z' });
    });

    it('keeps the database name and store layout', async () => {
      const session = makeSession('a');
      await putSession(session);
      expect(await readStore('sessions')).toEqual([session]);
      expect(await readStore('meta')).toEqual([sessionMeta(session)]);
    });

    it('deletes a session together with its meta', async () => {
      await putSession(makeSession('a'));
      await putSession(makeSession('b'));
      await deleteSession('a');

      expect(await getSession('a')).toBeNull();
      expect((await listSessions()).map((m) => m.id)).toEqual(['b']);
      expect(await getSession('b')).not.toBeNull();
    });

    it('deleting a missing session is not an error', async () => {
      await expect(deleteSession('nope')).resolves.toBeUndefined();
    });

    it('rejects when the write fails and stores nothing', async () => {
      const broken = { ...makeSession('a'), id: undefined } as unknown as GameSession;
      await expect(putSession(broken)).rejects.toBeDefined();
      expect(await listSessions()).toEqual([]);
    });

    it('works again after the connection is closed', async () => {
      await putSession(makeSession('a'));
      closeSessionStore();
      expect((await getSession('a'))?.id).toBe('a');
    });
  });

  describe('deleteFinishedSessions', () => {
    it('removes finished sessions only and returns the count', async () => {
      await putSession(finished('f1'));
      await putSession(finished('f2'));
      await putSession(makeSession('live'));

      expect(await deleteFinishedSessions()).toBe(2);
      expect((await listSessions()).map((m) => m.id)).toEqual(['live']);
      expect(await getSession('f1')).toBeNull();
      expect(await getSession('f2')).toBeNull();
      expect(await getSession('live')).not.toBeNull();
    });

    it('spares the sessions in keep', async () => {
      await putSession(finished('f1'));
      await putSession(finished('f2'));

      expect(await deleteFinishedSessions(['f2', 'unknown'])).toBe(1);
      expect((await listSessions()).map((m) => m.id)).toEqual(['f2']);
      expect(await getSession('f2')).not.toBeNull();
    });

    it('returns 0 when there is nothing to remove', async () => {
      await putSession(makeSession('live'));
      expect(await deleteFinishedSessions()).toBe(0);
      expect(await listSessions()).toHaveLength(1);
    });
  });

  describe('subscribeSessions', () => {
    it('calls subscribers on put and delete, with the change already stored', async () => {
      const seen: number[] = [];
      let pending: Promise<void> = Promise.resolve();
      const unsubscribe = subscribeSessions(() => {
        pending = listSessions().then((list) => void seen.push(list.length));
      });

      await putSession(makeSession('a'));
      await pending;
      await deleteSession('a');
      await pending;
      unsubscribe();

      expect(seen).toEqual([1, 0]);
    });

    it('calls subscribers when finished sessions are removed', async () => {
      await putSession(finished('f1'));
      const listener = vi.fn();
      const unsubscribe = subscribeSessions(listener);
      await deleteFinishedSessions();
      unsubscribe();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not call a listener after it has unsubscribed', async () => {
      const gone = vi.fn();
      const stays = vi.fn();
      const unsubscribeGone = subscribeSessions(gone);
      const unsubscribeStays = subscribeSessions(stays);

      await putSession(makeSession('a'));
      unsubscribeGone();
      await putSession(makeSession('b'));
      await deleteSession('a');
      unsubscribeStays();

      expect(gone).toHaveBeenCalledTimes(1);
      expect(stays).toHaveBeenCalledTimes(3);
    });

    it('does not notify when a write fails', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeSessions(listener);
      const broken = { ...makeSession('a'), id: undefined } as unknown as GameSession;
      await expect(putSession(broken)).rejects.toBeDefined();
      unsubscribe();
      expect(listener).not.toHaveBeenCalled();
    });

    it('hears changes announced by another tab', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeSessions(listener);
      const otherTab = new BroadcastChannel('chaiba-sessions');
      try {
        otherTab.postMessage('changed');
        await vi.waitFor(() => expect(listener).toHaveBeenCalled());
      } finally {
        otherTab.close();
        unsubscribe();
      }
    });

    it('announces changes to other tabs', async () => {
      const otherTab = new BroadcastChannel('chaiba-sessions');
      const heard = vi.fn();
      otherTab.onmessage = heard;
      try {
        await putSession(makeSession('a'));
        await vi.waitFor(() => expect(heard).toHaveBeenCalled());
      } finally {
        otherTab.close();
      }
    });
  });

  describe('createSessionWriter', () => {
    it('stores the session as it was when save() was called', async () => {
      const onError = vi.fn();
      const writer = createSessionWriter(onError);
      const session = makeSession('a');

      writer.save(session);
      session.players.white.name = 'Changed later';
      session.chat.push({ at: session.createdAt, role: 'system', text: 'added later' });
      await writer.flush();

      const stored = await getSession('a');
      expect(stored?.players.white.name).toBe('Tal');
      expect(stored?.chat).toEqual([]);
      expect(onError).not.toHaveBeenCalled();
    });

    it('ends with the last saved state after rapid saves', async () => {
      const writer = createSessionWriter(vi.fn());
      const session = makeSession('a');
      const writes = vi.fn();
      const unsubscribe = subscribeSessions(writes);

      for (let i = 1; i <= 20; i++) {
        session.chat.push({ at: session.createdAt, role: 'system', text: `line ${i}` });
        session.updatedAt = `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`;
        writer.save(session);
      }
      await writer.flush();
      unsubscribe();

      const stored = await getSession('a');
      expect(stored?.chat).toHaveLength(20);
      expect(stored?.updatedAt).toBe('2026-01-01T00:00:20.000Z');
      expect((await listSessions())[0].updatedAt).toBe('2026-01-01T00:00:20.000Z');
      // The first snapshot and the latest one; everything in between was superseded.
      expect(writes).toHaveBeenCalledTimes(2);
    });

    it('never stores an older state after a newer one', async () => {
      const writer = createSessionWriter(vi.fn());
      const session = makeSession('a');
      const stored: number[] = [];
      let pending: Promise<void> = Promise.resolve();
      const unsubscribe = subscribeSessions(() => {
        pending = getSession('a').then((s) => void stored.push(s?.chat.length ?? -1));
      });

      for (let i = 1; i <= 5; i++) {
        session.chat.push({ at: session.createdAt, role: 'system', text: `line ${i}` });
        writer.save(session);
        // Let some writes start between saves.
        if (i % 2 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await writer.flush();
      await pending;
      unsubscribe();

      expect(stored.length).toBeGreaterThan(0);
      expect(stored).toEqual([...stored].sort((a, b) => a - b));
      expect((await getSession('a'))?.chat).toHaveLength(5);
    });

    it('flush resolves only after the writes are stored', async () => {
      const writer = createSessionWriter(vi.fn());
      writer.save(makeSession('a'));
      writer.save(makeSession('b'));
      await writer.flush();

      expect((await listSessions()).map((m) => m.id).sort()).toEqual(['a', 'b']);
    });

    it('flush resolves at once when nothing is queued', async () => {
      const writer = createSessionWriter(vi.fn());
      await expect(writer.flush()).resolves.toBeUndefined();
      writer.save(makeSession('a'));
      await writer.flush();
      await expect(writer.flush()).resolves.toBeUndefined();
    });

    it('reports a failed write and keeps working', async () => {
      const onError = vi.fn();
      const writer = createSessionWriter(onError);

      writer.save({ ...makeSession('bad'), id: undefined } as unknown as GameSession);
      await writer.flush();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeDefined();

      writer.save(makeSession('good'));
      await writer.flush();
      expect(onError).toHaveBeenCalledTimes(1);
      expect((await listSessions()).map((m) => m.id)).toEqual(['good']);
    });

    it('a failed write does not block a save queued behind it', async () => {
      const onError = vi.fn();
      const writer = createSessionWriter(onError);

      writer.save({ ...makeSession('bad'), id: undefined } as unknown as GameSession);
      writer.save(makeSession('good'));
      await writer.flush();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(await getSession('good')).not.toBeNull();
    });
  });
});
