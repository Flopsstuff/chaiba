/**
 * Game session: the complete record of one game as a single JSON document.
 *
 * Everything about the game goes in here — setup, players, moves, every LLM
 * call with its usage and timing, the agents' conversation and the arena chat.
 * This module is the model only: the schema and pure functions over it.
 * Storage is in sessionStore.ts (IndexedDB); a session is stored once the
 * game has started, and it is what Settings exports and imports.
 */
import { z } from 'zod';
import { ChessEngine } from '../chess/engine';
import { isCheckmate, isStalemate } from '../chess/rules';
import type { ChessColor, LogRestoreEntry } from '../types';

const FORMAT = 'chaiba-session';
const VERSION = 1;

const colorSchema = z.enum(['white', 'black']);

const toolCallSchema = z.object({
  id: z.string(),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
});

/** Same shape as `Message` in src/types. */
const messageSchema = z.object({
  sender: z.enum(['system', 'moderator', 'agent']),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  content: z.string(),
  toolCalls: z.array(toolCallSchema).optional(),
  toolResultFor: z.object({ callId: z.string(), toolName: z.string() }).optional(),
  moveNumber: z.number().optional(),
  moveColor: colorSchema.optional(),
});

const playerSchema = z.object({
  /** Agent id; messages and calls refer to the player by it. */
  id: z.string(),
  name: z.string(),
  /** OpenRouter model id. */
  model: z.string(),
  modelName: z.string().optional(),
  /** Base + color prompt from Settings, as it was when the game started. */
  basePrompt: z.string(),
  /** Per-agent custom instructions, appended to the base prompt. */
  customPrompt: z.string(),
});

const moveSchema = z.object({
  /** Half-move index, starting at 1. */
  ply: z.number(),
  moveNumber: z.number(),
  color: colorSchema,
  san: z.string(),
  uci: z.string(),
  fenAfter: z.string(),
  /** 'agent' — played by the model; 'manual' — dragged on the board by the user. */
  source: z.enum(['agent', 'manual']),
  at: z.string(),
  /** Agent moves: the call that produced the move. */
  callId: z.string().optional(),
  /** Agent moves: number of LLM calls the turn took (1 = no retries). */
  attempts: z.number().optional(),
  /** Agent moves: total time spent in LLM calls for this turn. */
  thinkingMs: z.number().optional(),
});

const callSchema = z.object({
  id: z.string(),
  color: colorSchema,
  agentId: z.string(),
  model: z.string(),
  moveNumber: z.number(),
  /** 1 for the first try of a turn, 2+ for retries. */
  attempt: z.number(),
  startedAt: z.string(),
  durationMs: z.number(),
  /** Game settings in effect for this turn. */
  settings: z.object({
    sendContext: z.boolean(),
    sendFenOnError: z.boolean(),
    retryAttempts: z.number(),
  }),
  /**
   * The request is the first `historyCount` entries of `messages` followed by
   * `input`. Storing it this way instead of the full request keeps the session
   * from growing quadratically with the length of the game.
   */
  historyCount: z.number(),
  input: z.array(messageSchema),
  response: z.object({
    text: z.string(),
    /** Model reasoning ("thinking") text, when the provider returns it. */
    reasoning: z.string().optional(),
    toolCalls: z.array(toolCallSchema),
    finishReason: z.string().optional(),
    /** Provider-side generation id and the model that actually answered. */
    id: z.string().optional(),
    modelId: z.string().optional(),
  }).optional(),
  /** Token usage as reported by the AI SDK; `raw` is OpenRouter's own usage object. */
  usage: z.record(z.string(), z.unknown()).optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
  cost: z.number(),
  outcome: z.enum(['move', 'invalid-move', 'no-move', 'error']),
  /** The move the model asked for, valid or not. */
  move: z.string().optional(),
  error: z.string().optional(),
});

const chatSchema = z.object({
  at: z.string(),
  role: z.enum(['system', 'white', 'black', 'moderator']),
  text: z.string(),
  sender: z.string().optional(),
});

const sessionSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** 'finished' once the game ended by checkmate or stalemate. */
  status: z.enum(['in-progress', 'finished']).default('in-progress'),
  result: z.object({
    reason: z.enum(['checkmate', 'stalemate']),
    winner: colorSchema.nullable(),
  }).optional(),
  finishedAt: z.string().optional(),
  mode: z.enum(['standard', 'chess960']),
  initialFen: z.string(),
  players: z.object({ white: playerSchema, black: playerSchema }),
  moves: z.array(moveSchema),
  calls: z.array(callSchema),
  /** The agents' shared conversation — what the models are shown. */
  messages: z.array(messageSchema),
  /** The arena chat log — what the user sees in the middle column. */
  chat: z.array(chatSchema),
});

export type GameSession = z.infer<typeof sessionSchema>;
export type SessionPlayer = z.infer<typeof playerSchema>;
export type SessionMove = z.infer<typeof moveSchema>;
export type SessionCall = z.infer<typeof callSchema>;
export type SessionChatEntry = z.infer<typeof chatSchema>;
export type SessionResult = NonNullable<GameSession['result']>;

/** The few facts about a session that a list of games shows. */
export interface SessionMeta {
  id: string;
  status: GameSession['status'];
  winner: ChessColor | null;
  mode: GameSession['mode'];
  white: { name: string; model: string };
  black: { name: string; model: string };
  /** Half-moves played. */
  plies: number;
  cost: number;
  createdAt: string;
  updatedAt: string;
}

export function sessionMeta(session: GameSession): SessionMeta {
  const player = (color: ChessColor) => ({ name: session.players[color].name, model: session.players[color].model });
  return {
    id: session.id,
    status: session.status,
    winner: session.result?.winner ?? null,
    mode: session.mode,
    white: player('white'),
    black: player('black'),
    plies: session.moves.length,
    cost: session.calls.reduce((sum, c) => sum + c.cost, 0),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/** How the game on `engine` ended, or null while it is still going. */
export function gameResult(engine: ChessEngine): SessionResult | null {
  const state = engine.getState();
  const toMove = state.activeColor;
  if (isCheckmate(state, toMove)) return { reason: 'checkmate', winner: toMove === 'white' ? 'black' : 'white' };
  if (isStalemate(state, toMove)) return { reason: 'stalemate', winner: null };
  return null;
}

/** Bring `status`, `result` and `finishedAt` in line with the position on `engine`. */
export function syncResult(session: GameSession, engine: ChessEngine): void {
  const result = gameResult(engine);
  if (result) {
    session.status = 'finished';
    session.result = result;
    session.finishedAt ??= new Date().toISOString();
  } else {
    session.status = 'in-progress';
    delete session.result;
    delete session.finishedAt;
  }
}

export function createSession(init: {
  mode: GameSession['mode'];
  initialFen: string;
  players: GameSession['players'];
}): GameSession {
  const now = new Date().toISOString();
  return {
    format: FORMAT,
    version: VERSION,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'in-progress',
    mode: init.mode,
    initialFen: init.initialFen,
    players: init.players,
    moves: [],
    calls: [],
    messages: [],
    chat: [],
  };
}

/** True once anything has happened in the game. */
export function isSessionStarted(session: GameSession): boolean {
  return session.moves.length > 0 || session.messages.length > 0 || session.calls.length > 0;
}

/** Validate parsed JSON as a session. Throws an Error with a readable message. */
export function parseSession(data: unknown): GameSession {
  const result = sessionSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Not a valid CHAIBA session${where}: ${issue.message}`);
  }
  return result.data;
}

/**
 * Rebuild the board by replaying the session's moves from its initial position.
 * Throws if the session does not describe a legal game.
 */
export function replaySession(session: GameSession): ChessEngine {
  const engine = new ChessEngine();
  engine.setFEN(session.initialFen);
  for (const move of session.moves) {
    const result = engine.moveSAN(move.san);
    if (!result.success) {
      throw new Error(`Move ${move.ply} (${move.san}) cannot be replayed: ${result.error}`);
    }
  }
  return engine;
}

/** Parse, validate and replay a session from JSON text. Throws on any problem. */
export function readSession(json: string): { session: GameSession; engine: ChessEngine } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  return openSession(data);
}

/**
 * Validate a session object and rebuild its board. The status and result are
 * taken from the replayed position, not trusted from the data.
 */
export function openSession(data: unknown): { session: GameSession; engine: ChessEngine } {
  const session = parseSession(data);
  const engine = replaySession(session);
  syncResult(session, engine);
  return { session, engine };
}

/** The move just played on `engine`, as a session move record. */
export function describeLastMove(engine: ChessEngine, source: SessionMove['source']): SessionMove {
  const history = engine.getHistory();
  const last = history[history.length - 1];
  const san = engine.getSAN();
  const square = (i: number) => String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1);
  const promotion = last.promotion ? (last.promotion === 'knight' ? 'n' : last.promotion[0]) : '';
  return {
    ply: history.length,
    moveNumber: last.stateBefore.fullmoveNumber,
    color: last.color,
    san: san[san.length - 1],
    uci: square(last.from) + square(last.to) + promotion,
    fenAfter: engine.getFEN(),
    source,
    at: new Date().toISOString(),
  };
}

/** What an agent needs to rebuild its message log (the ⓘ view) after a restore. */
export function logEntriesFor(session: GameSession, color: ChessColor): LogRestoreEntry[] {
  const opponentColor: ChessColor = color === 'white' ? 'black' : 'white';
  const opponent = { name: session.players[opponentColor].name, color: opponentColor };
  const entries: LogRestoreEntry[] = [];
  for (const call of session.calls) {
    if (call.color !== color || !call.response) continue;
    const response: Record<string, unknown> = { role: 'assistant' };
    if (call.response.text) response.text = call.response.text;
    if (call.response.toolCalls.length > 0) response.toolCalls = call.response.toolCalls;
    if (call.usage) response.usage = call.usage;
    entries.push({
      timestamp: Date.parse(call.startedAt),
      messages: [...session.messages.slice(0, call.historyCount), ...call.input],
      opponent,
      moveNumber: call.moveNumber,
      response,
    });
  }
  return entries;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function summarizePlayer(session: GameSession, color: ChessColor) {
  const calls = session.calls.filter((c) => c.color === color);
  const moves = session.moves.filter((m) => m.color === color);
  return {
    name: session.players[color].name,
    model: session.players[color].model,
    moves: moves.length,
    manualMoves: moves.filter((m) => m.source === 'manual').length,
    calls: calls.length,
    invalidMoves: calls.filter((c) => c.outcome === 'invalid-move').length,
    noMoveResponses: calls.filter((c) => c.outcome === 'no-move').length,
    errors: calls.filter((c) => c.outcome === 'error').length,
    cost: calls.reduce((sum, c) => sum + c.cost, 0),
    inputTokens: calls.reduce((sum, c) => sum + num(c.usage?.inputTokens), 0),
    outputTokens: calls.reduce((sum, c) => sum + num(c.usage?.outputTokens), 0),
    thinkingMs: calls.reduce((sum, c) => sum + c.durationMs, 0),
  };
}

/** Totals derived from the session: result, per-player cost, tokens and time. */
export function summarizeSession(session: GameSession, engine: ChessEngine) {
  const result = gameResult(engine);
  const status: 'not-started' | 'in-progress' | 'checkmate' | 'stalemate' =
    result?.reason ?? (isSessionStarted(session) ? 'in-progress' : 'not-started');
  const winner = result?.winner ?? null;
  const white = summarizePlayer(session, 'white');
  const black = summarizePlayer(session, 'black');
  return {
    status,
    winner,
    plies: session.moves.length,
    fen: engine.getFEN(),
    san: engine.getSAN().map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(' '),
    totalCost: white.cost + black.cost,
    white,
    black,
  };
}

/** The session as pretty-printed JSON, with a derived summary added for the reader. */
export function exportSession(session: GameSession, engine: ChessEngine): string {
  return JSON.stringify(
    { ...session, exportedAt: new Date().toISOString(), summary: summarizeSession(session, engine) },
    null,
    2,
  );
}

export function sessionFileName(session: GameSession): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stamp = session.createdAt.slice(0, 16).replace(/[:T]/g, '-');
  return `chaiba-${slug(session.players.white.name)}-vs-${slug(session.players.black.name)}-${stamp}.json`;
}
