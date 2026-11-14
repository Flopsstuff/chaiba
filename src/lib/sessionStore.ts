/**
 * Storage for game sessions: IndexedDB database 'chaiba'.
 *
 * Two object stores, always written together in one transaction:
 * - 'sessions' — the full session documents, keyed by id;
 * - 'meta'     — a SessionMeta per session, so that a list of games can be
 *                shown without reading the full documents.
 *
 * Every change is announced on a BroadcastChannel so that lists in this and
 * other tabs can refresh.
 */
import { sessionMeta } from './session';
import type { GameSession, SessionMeta } from './session';

const DB_NAME = 'chaiba';
const DB_VERSION = 1;
const SESSIONS = 'sessions';
const META = 'meta';
const BOTH = [SESSIONS, META];
const CHANNEL_NAME = 'chaiba-sessions';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const forget = () => {
        if (dbPromise === opening) dbPromise = null;
      };
      // Another tab wants to upgrade or delete the database: get out of its way.
      db.onversionchange = () => {
        db.close();
        forget();
      };
      // The browser closed the connection on its own (e.g. storage was cleared).
      db.onclose = forget;
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open the session database.'));
  });
  dbPromise = opening;
  // A failed open must not be cached, or no later call could ever succeed.
  opening.catch(() => {
    if (dbPromise === opening) dbPromise = null;
  });
  return opening;
}

/**
 * Close the cached database connection; the next call opens a new one.
 * Meant for tests that replace `indexedDB` between cases.
 */
export function closeSessionStore(): void {
  const opening = dbPromise;
  dbPromise = null;
  opening?.then((db) => db.close(), () => {});
}

/**
 * Run `work` in one transaction. Resolves only when the transaction has
 * completed — a successful request alone does not mean the data is stored.
 * Resolves with the result of the request `work` returns, if any.
 */
async function transact<T = undefined>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let request: IDBRequest<T> | void;
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    const fail = () => reject(tx.error ?? new Error('The session database transaction was aborted.'));
    tx.onerror = fail;
    tx.onabort = fail;
    try {
      request = work(tx);
    } catch (error) {
      // Report the real cause; the abort that follows would only say "aborted".
      reject(error);
      try {
        tx.abort();
      } catch {
        // Already finished or aborted.
      }
    }
  });
}

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function notifyLocal(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      // One broken listener must not keep the others from refreshing.
      console.error(error);
    }
  }
}

/** The shared channel, created on first use; null where BroadcastChannel does not exist. */
function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = notifyLocal;
    // In Node an open channel keeps the process alive; browsers have no unref.
    (channel as { unref?: () => void }).unref?.();
  } catch {
    channel = null;
  }
  return channel;
}

function notifyChanged(): void {
  try {
    getChannel()?.postMessage('changed');
  } catch {
    // Other tabs miss one refresh; the write itself has succeeded.
  }
  // BroadcastChannel does not deliver to its sender.
  notifyLocal();
}

/** Store the session (insert or replace) together with its meta. */
export async function putSession(session: GameSession): Promise<void> {
  await transact(BOTH, 'readwrite', (tx) => {
    tx.objectStore(SESSIONS).put(session);
    tx.objectStore(META).put(sessionMeta(session));
  });
  notifyChanged();
}

/** The stored session document, or null if there is none with this id. */
export async function getSession(id: string): Promise<GameSession | null> {
  const found = await transact<GameSession | undefined>([SESSIONS], 'readonly', (tx) =>
    tx.objectStore(SESSIONS).get(id),
  );
  return found ?? null;
}

/** Remove the session and its meta. Removing a missing session is not an error. */
export async function deleteSession(id: string): Promise<void> {
  await transact(BOTH, 'readwrite', (tx) => {
    tx.objectStore(SESSIONS).delete(id);
    tx.objectStore(META).delete(id);
  });
  notifyChanged();
}

/** Meta of every stored session, most recently updated first. */
export async function listSessions(): Promise<SessionMeta[]> {
  const all = (await transact<SessionMeta[]>([META], 'readonly', (tx) => tx.objectStore(META).getAll())) ?? [];
  // ISO timestamps sort correctly as strings.
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/** Remove every finished session except those in `keep`. Returns how many were removed. */
export async function deleteFinishedSessions(keep: string[] = []): Promise<number> {
  const kept = new Set(keep);
  let removed = 0;
  // Read and delete in the same transaction so a concurrent put cannot slip in between.
  await transact(BOTH, 'readwrite', (tx) => {
    const sessions = tx.objectStore(SESSIONS);
    const meta = tx.objectStore(META);
    const request = meta.getAll() as IDBRequest<SessionMeta[]>;
    request.onsuccess = () => {
      for (const item of request.result) {
        if (item.status !== 'finished' || kept.has(item.id)) continue;
        sessions.delete(item.id);
        meta.delete(item.id);
        removed++;
      }
    };
  });
  if (removed > 0) notifyChanged();
  return removed;
}

/** Call `listener` whenever sessions change, in this tab or another. Returns the unsubscribe function. */
export function subscribeSessions(listener: () => void): () => void {
  // Each subscription is its own entry, so the same function can subscribe twice.
  const entry = () => listener();
  listeners.add(entry);
  getChannel();
  return () => {
    listeners.delete(entry);
  };
}

export interface SessionWriter {
  /** Queue the session's current state to be stored. Returns immediately. */
  save(session: GameSession): void;
  /** Resolves when everything queued so far has been stored (or has failed). */
  flush(): Promise<void>;
}

/**
 * A writer for one live game. Each save() snapshots the session at call time;
 * writes run one at a time, and a snapshot that is still waiting is replaced
 * by a newer one, so storage never ends up with an older state than the
 * latest saved. `onError` is called when a write fails.
 */
export function createSessionWriter(onError: (error: unknown) => void): SessionWriter {
  let waiting: GameSession | null = null;
  let running = false;
  let idleWaiters: Array<() => void> = [];

  const report = (error: unknown) => {
    try {
      onError(error);
    } catch (handlerError) {
      // A throwing handler must not stall the queue.
      console.error(handlerError);
    }
  };

  const drain = async () => {
    running = true;
    while (waiting) {
      const snapshot = waiting;
      waiting = null;
      try {
        await putSession(snapshot);
      } catch (error) {
        report(error);
      }
    }
    running = false;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  };

  return {
    save(session) {
      try {
        // The caller keeps mutating this object; store what it is right now.
        waiting = structuredClone(session);
      } catch (error) {
        report(error);
        return;
      }
      if (!running) void drain();
    },
    flush() {
      if (!running) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
  };
}
