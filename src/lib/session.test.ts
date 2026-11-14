import { ChessEngine } from '../chess/engine';
import {
  createSession,
  describeLastMove,
  exportSession,
  isSessionStarted,
  logEntriesFor,
  openSession,
  parseSession,
  readSession,
  sessionFileName,
  sessionMeta,
  syncResult,
  summarizeSession,
} from './session';
import type { GameSession, SessionCall } from './session';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function players(): GameSession['players'] {
  return {
    white: { id: 'w-1', name: 'Tal', model: 'a/white', basePrompt: 'base white', customPrompt: '' },
    black: { id: 'b-1', name: 'Anand', model: 'b/black', modelName: 'Black Model', basePrompt: 'base black', customPrompt: 'be bold' },
  };
}

function call(over: Partial<SessionCall>): SessionCall {
  return {
    id: 'c',
    color: 'white',
    agentId: 'w-1',
    model: 'a/white',
    moveNumber: 1,
    attempt: 1,
    startedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1000,
    settings: { sendContext: true, sendFenOnError: false, retryAttempts: 0 },
    historyCount: 0,
    input: [],
    cost: 0,
    outcome: 'move',
    ...over,
  };
}

/** A session with the given SAN moves played manually. */
function played(sans: string[], fen = START_FEN): { session: GameSession; engine: ChessEngine } {
  const engine = new ChessEngine();
  engine.setFEN(fen);
  const session = createSession({ mode: 'standard', initialFen: fen, players: players() });
  for (const san of sans) {
    expect(engine.moveSAN(san)).toEqual({ success: true });
    session.moves.push(describeLastMove(engine, 'manual'));
  }
  return { session, engine };
}

describe('session', () => {
  it('starts empty and not started', () => {
    const session = createSession({ mode: 'chess960', initialFen: START_FEN, players: players() });
    expect(session.format).toBe('chaiba-session');
    expect(session.mode).toBe('chess960');
    expect(isSessionStarted(session)).toBe(false);
  });

  it('records moves with ply, move number, UCI and the position after', () => {
    const { session } = played(['e4', 'e5', 'Nf3']);
    expect(session.moves.map((m) => [m.ply, m.moveNumber, m.color, m.san, m.uci])).toEqual([
      [1, 1, 'white', 'e4', 'e2e4'],
      [2, 1, 'black', 'e5', 'e7e5'],
      [3, 2, 'white', 'Nf3', 'g1f3'],
    ]);
    expect(session.moves[0].fenAfter).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    expect(isSessionStarted(session)).toBe(true);
  });

  it('writes the promotion piece into the UCI move', () => {
    const { session } = played(['a8=N'], '8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(session.moves[0].uci).toBe('a7a8n');
  });

  it('reopens from a plain copy with the board rebuilt', () => {
    const { session, engine } = played(['e4', 'c5', 'Nf3']);
    const reopened = openSession(structuredClone(session));
    expect(reopened.session).toEqual(session);
    expect(reopened.engine.getFEN()).toBe(engine.getFEN());
    expect(reopened.engine.getSAN()).toEqual(['e4', 'c5', 'Nf3']);
  });

  it('marks the game finished when it ends, with the winner', () => {
    const { session, engine } = played(['f3', 'e5', 'g4']);
    syncResult(session, engine);
    expect(session.status).toBe('in-progress');
    expect(session.result).toBeUndefined();
    expect(engine.moveSAN('Qh4#')).toEqual({ success: true });
    session.moves.push(describeLastMove(engine, 'manual'));
    syncResult(session, engine);
    expect(session.status).toBe('finished');
    expect(session.result).toEqual({ reason: 'checkmate', winner: 'black' });
    expect(session.finishedAt).toBeTruthy();
    expect(sessionMeta(session)).toMatchObject({ status: 'finished', winner: 'black', plies: 4, white: { name: 'Tal', model: 'a/white' } });
  });

  it('takes the status from the position, not from the file', () => {
    const { session } = played(['f3', 'e5', 'g4', 'Qh4#']);
    const data = { ...structuredClone(session), status: undefined, result: undefined };
    expect(openSession(data).session.status).toBe('finished');
    const lying = { ...structuredClone(played(['e4']).session), status: 'finished', result: { reason: 'checkmate', winner: 'white' } };
    const opened = openSession(lying).session;
    expect(opened.status).toBe('in-progress');
    expect(opened.result).toBeUndefined();
  });

  it('imports its own export, dropping the derived summary', () => {
    const { session, engine } = played(['d4', 'd5']);
    const exported = exportSession(session, engine);
    expect(JSON.parse(exported).summary.plies).toBe(2);
    const imported = readSession(exported);
    expect(imported.session).toEqual(session);
    expect(imported.engine.getFEN()).toBe(engine.getFEN());
  });

  it('rejects files that are not a playable session', () => {
    expect(() => readSession('nope')).toThrow('not valid JSON');
    expect(() => parseSession({ format: 'chaiba-session', version: 1 })).toThrow(/Not a valid CHAIBA session at/);
    vi.restoreAllMocks();
    const { session } = played(['e4']);
    session.moves[0].san = 'Qh5';
    expect(() => readSession(JSON.stringify(session))).toThrow(/Move 1 \(Qh5\) cannot be replayed/);
  });

  it('summarizes result, cost, tokens and thinking time per player', () => {
    const { session, engine } = played(['f3', 'e5', 'g4', 'Qh4#']);
    session.calls.push(
      call({ color: 'white', cost: 0.01, durationMs: 1500, usage: { inputTokens: 100, outputTokens: 20 } }),
      call({ color: 'white', cost: 0.02, durationMs: 500, outcome: 'invalid-move', usage: { inputTokens: 150, outputTokens: 30 } }),
      call({ color: 'black', agentId: 'b-1', cost: 0.5, durationMs: 4000, outcome: 'error' }),
    );
    const summary = summarizeSession(session, engine);
    expect(summary.status).toBe('checkmate');
    expect(summary.winner).toBe('black');
    expect(summary.san).toBe('1. f3 e5 2. g4 Qh4#');
    expect(summary.totalCost).toBeCloseTo(0.53);
    expect(summary.white).toMatchObject({
      name: 'Tal', moves: 2, manualMoves: 2, calls: 2, invalidMoves: 1, inputTokens: 250, outputTokens: 50, thinkingMs: 2000,
    });
    expect(summary.white.cost).toBeCloseTo(0.03);
    expect(summary.black).toMatchObject({ calls: 1, errors: 1, thinkingMs: 4000 });
  });

  it('reports a game that has not begun', () => {
    const { session, engine } = played([]);
    expect(summarizeSession(session, engine).status).toBe('not-started');
  });

  it('rebuilds each call request from the shared history and the call input', () => {
    const { session } = played(['e4']);
    session.messages = [
      { sender: 'moderator', content: 'hello' },
      { sender: 'agent', agentId: 'w-1', content: 'e4!' },
    ];
    const context = { sender: 'system' as const, agentId: 'b-1', content: 'your move' };
    session.calls.push(
      call({ id: 'c1', color: 'white', historyCount: 1, response: { text: 'e4!', toolCalls: [] }, usage: { raw: { cost: 0.01 } } }),
      call({ id: 'c2', color: 'black', agentId: 'b-1', moveNumber: 1, historyCount: 2, input: [context],
        response: { text: '', toolCalls: [{ id: 't1', tool: 'make-move', args: { move: 'e5' } }] } }),
      call({ id: 'c3', color: 'black', agentId: 'b-1', outcome: 'error', error: 'boom' }),
    );
    const white = logEntriesFor(session, 'white');
    expect(white).toHaveLength(1);
    expect(white[0].messages).toEqual([session.messages[0]]);
    expect(white[0].opponent).toEqual({ name: 'Anand', color: 'black' });
    expect(white[0].response).toEqual({ role: 'assistant', text: 'e4!', usage: { raw: { cost: 0.01 } } });

    // The failed call has no response and is left out of the log.
    const black = logEntriesFor(session, 'black');
    expect(black).toHaveLength(1);
    expect(black[0].messages).toEqual([...session.messages, context]);
    expect(black[0].response).toEqual({ role: 'assistant', toolCalls: [{ id: 't1', tool: 'make-move', args: { move: 'e5' } }] });
  });

  it('names the export file after the players and the start time', () => {
    const { session } = played([]);
    session.createdAt = '2026-11-14T20:45:10.000Z';
    expect(sessionFileName(session)).toBe('chaiba-tal-vs-anand-2026-11-14-20-45.json');
  });
});
