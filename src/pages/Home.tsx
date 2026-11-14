import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { WhitePanel } from '../components/panels/WhitePanel';
import { Arena } from '../components/panels/Arena';
import { BlackPanel } from '../components/panels/BlackPanel';
import { ChessEngine } from '../chess/engine';
import { isCheckmate, isStalemate } from '../chess/rules';
import type { GameState } from '../chess/types';
import type { GameChatHandle } from '../components/chat/GameChat';
import type { AgentCardHandle } from '../components/panels/AgentCard';
import { soundForMove } from '../lib/soundEvents';
import { playSound } from '../lib/sounds';
import { describeLastMove, isSessionStarted, logEntriesFor, syncResult } from '../lib/session';
import type { GameSession, SessionCall, SessionPlayer } from '../lib/session';
import { createSessionWriter } from '../lib/sessionStore';
import { MoveCommand } from '../types';
import type { ChessColor, GenerateResult, Message } from '../types';
import './Home.css';

const MOBILE_BREAKPOINT = 768;

/** Play the sound for a move just made; `state` is the position after it. */
function playMoveSound(state: GameState, san: string) {
  playSound(soundForMove(san, isStalemate(state, state.activeColor)));
}

/** What a new game inherits from the one before it: the models and custom instructions. */
export type PlayerDefaults = Pick<SessionPlayer, 'model' | 'modelName' | 'customPrompt'>;

interface HomeProps {
  /** The game to show: one loaded from storage, or a blank one being set up. */
  initial: { session: GameSession; engine: ChessEngine; stored: boolean };
  /** For a new game: the previous game's models and custom instructions. */
  defaults?: Record<ChessColor, PlayerDefaults>;
  /** Another tab has taken this game over: stop playing and stop saving. */
  frozen?: boolean;
  /** The game has started: it now has a place in storage and an address. */
  onStarted: (session: GameSession) => void;
  /** The user asked for a new game (Reset). */
  onNewGame: (fischer: boolean, players: GameSession['players']) => void;
}

/**
 * One game, from setup to the end. A Home instance lives exactly as long as
 * its game: the parent mounts a new one for a new or another game.
 */
export function Home({ initial, defaults, frozen, onStarted, onNewGame }: HomeProps) {
  const engineRef = useRef<ChessEngine>(initial.engine);
  const sessionRef = useRef<GameSession>(initial.session);
  const playersRef = useRef<GameSession['players']>(initial.session.players);
  const saveFailedRef = useRef(false);
  const frozenRef = useRef(false);
  const unmountedRef = useRef(false);
  const announcedRef = useRef(false);
  // A game is stored from its first move or message on, not while it is being set up.
  const [started, setStarted] = useState(initial.stored);
  const startedRef = useRef(initial.stored);
  const [writer] = useState(() => createSessionWriter((error) => {
    console.warn('[session] save failed:', error);
    if (saveFailedRef.current) return;
    saveFailedRef.current = true;
    chatRef.current?.addSystemMessage('Could not save the game to browser storage — it will not survive a reload. Export it from Settings to keep it.');
  }));
  const [gameState, setGameState] = useState<GameState>(() => initial.engine.getState());
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(() => {
    const history = initial.engine.getHistory();
    const last = history[history.length - 1];
    return last ? { from: last.from, to: last.to } : null;
  });
  const [sanMoves, setSanMoves] = useState<string[]>(() => initial.engine.getSAN());
  const [sharedMessages, setSharedMessages] = useState<Message[]>(initial.session.messages);
  const sharedMessagesRef = useRef<Message[]>(initial.session.messages);
  const chatRef = useRef<GameChatHandle>(null);
  const whiteRef = useRef<AgentCardHandle>(null);
  const blackRef = useRef<AgentCardHandle>(null);
  // A stored game keeps the players it was started with.
  const restoredPlayers = initial.stored ? initial.session.players : null;
  const [thinkingColor, setThinkingColor] = useState<ChessColor | null>(null);
  const [whiteOpen, setWhiteOpen] = useState(false);
  const [blackOpen, setBlackOpen] = useState(false);
  const isFischer = initial.session.mode === 'chess960';
  const [totalCost, setTotalCost] = useState(() => initial.session.calls.reduce((sum, c) => sum + c.cost, 0));
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);
  const handleAgentMoveRef = useRef<(color: ChessColor) => Promise<boolean>>(null!);
  const notationRef = useRef<HTMLDivElement>(null);

  /** Store the session — from the moment the game starts, and only while this tab owns it. */
  const save = useCallback(() => {
    const session = sessionRef.current;
    if (frozenRef.current || !isSessionStarted(session)) return;
    session.updatedAt = new Date().toISOString();
    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
      onStarted(session);
    }
    writer.save(session);
  }, [writer, onStarted]);

  useEffect(() => {
    frozenRef.current = !!frozen;
    if (frozen) setAutoPlay(false);
  }, [frozen]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  /** Post a system line to the arena chat and record it in the session. */
  const say = useCallback((text: string) => {
    chatRef.current?.addSystemMessage(text);
    sessionRef.current.chat.push({ at: new Date().toISOString(), role: 'system', text });
    save();
  }, [save]);

  /** Replace the agents' shared conversation, in the UI and in the session. */
  const commitMessages = useCallback((next: Message[]) => {
    sharedMessagesRef.current = next;
    setSharedMessages(next);
    sessionRef.current.messages = next;
    save();
  }, [save]);

  const handleSetupChange = useCallback((color: ChessColor, setup: SessionPlayer) => {
    playersRef.current = { ...playersRef.current, [color]: setup };
    const session = sessionRef.current;
    // Once the game is under way its players are fixed.
    if (isSessionStarted(session)) return;
    session.players = playersRef.current;
    save();
  }, [save]);

  const handleMove = useCallback((from: number, to: number) => {
    const engine = engineRef.current;
    const fileChar = (i: number) => String.fromCharCode(97 + (i % 8));
    const rankChar = (i: number) => String(Math.floor(i / 8) + 1);
    const uci = fileChar(from) + rankChar(from) + fileChar(to) + rankChar(to);

    const result = engine.moveUCI(uci);
    if (result.success) {
      setGameState(engine.getState());
      setLastMove({ from, to });
      const san = engine.getSAN();
      setSanMoves(san);
      const lastSan = san[san.length - 1];
      playMoveSound(engine.getState(), lastSan);
      const moveNum = Math.ceil(san.length / 2);
      const side = san.length % 2 === 1 ? 'White' : 'Black';
      sessionRef.current.moves.push(describeLastMove(engine, 'manual'));
      syncResult(sessionRef.current, engine);
      say(`${moveNum}. ${side}: ${lastSan}`);

      // Record manual move in shared messages as if the agent made it.
      // This reuses the existing tool-call/tool-result mechanism so that
      // convertMessages treats it correctly for both agents:
      // - moving agent sees it as own tool call + result
      // - opponent sees "Opponent played X"
      const movingColor = side === 'White' ? 'white' : 'black';
      const movingAgent = movingColor === 'white' ? whiteRef.current : blackRef.current;
      const callId = `manual-${Date.now()}`;
      const agentMsg: Message = {
        sender: 'agent',
        agentId: movingAgent?.id ?? `manual-${movingColor}`,
        agentName: movingAgent?.name ?? movingColor,
        content: '',
        toolCalls: [{ id: callId, tool: 'make-move', args: { move: lastSan } }],
      };
      const toolResultMsg: Message = {
        sender: 'system',
        agentId: movingAgent?.id ?? `manual-${movingColor}`,
        content: `Move ${lastSan} accepted.`,
        toolResultFor: { callId, toolName: 'make-move' },
      };
      commitMessages([...sharedMessagesRef.current, agentMsg, toolResultMsg]);
    } else {
      playSound('illegal');
      say(result.error);
    }
  }, [say, commitMessages]);

  const handleAgentMove = useCallback(async (color: ChessColor): Promise<boolean> => {
    const engine = engineRef.current;
    const state = engine.getState();

    if (state.activeColor !== color) {
      say(`It's not ${color}'s turn.`);
      return false;
    }

    const agentRef = color === 'white' ? whiteRef : blackRef;
    const agent = agentRef.current;
    if (!agent) {
      say(`${color} agent not ready.`);
      return false;
    }

    // If the game is left or another tab takes it over while the model is
    // thinking, its answer must not be played: this board is no longer the game.
    const session = sessionRef.current;
    const isStale = () => frozenRef.current || unmountedRef.current;

    setThinkingColor(color);

    // Get retry settings
    const retryAttempts = parseInt(localStorage.getItem('retry_attempts') || '0', 10);
    const sendFenOnError = localStorage.getItem('send_fen_on_error') === 'true';
    const maxAttempts = retryAttempts + 1; // 1 initial + N retries

    // Build context message with current FEN and move history (if enabled)
    const sendContext = localStorage.getItem('send_context_message') !== 'false';
    const settings = { sendContext, sendFenOnError, retryAttempts };
    const sharedLength = sharedMessagesRef.current.length;
    let messagesForAgent = [...sharedMessagesRef.current];

    let contextParts = '';
    if (sendContext) {
      const fen = engine.getFEN();
      const san = engine.getSAN();
      const moveHistory = san.length > 0
        ? `Moves so far: ${san.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(' ')}`
        : 'No moves yet.';
      contextParts = `Current position (FEN): ${fen}\n${moveHistory}\n`;
    }
    const contextMsg: Message = {
      sender: 'system',
      agentId: agent.id,
      content: `${contextParts}It is ${color}'s turn (move ${state.fullmoveNumber}). ${MoveCommand}.`,
      moveNumber: state.fullmoveNumber,
      moveColor: color,
    };
    messagesForAgent = [...messagesForAgent, contextMsg];

    const opponentRef = color === 'white' ? blackRef : whiteRef;
    const opponent = opponentRef.current
      ? { name: opponentRef.current.name, color: opponentRef.current.color }
      : undefined;

    try {
      let moveSucceeded = false;
      let attempt = 0;
      let thinkingMs = 0;
      const baseLength = messagesForAgent.length; // before retry loop
      let attemptStartIdx = baseLength;

      while (attempt < maxAttempts && !moveSucceeded) {
        attemptStartIdx = messagesForAgent.length;
        attempt++;
        const isRetry = attempt > 1;

        if (isRetry) {
          say(`Retry attempt ${attempt - 1}/${retryAttempts}...`);
        }

        const startedAt = Date.now();
        const call: SessionCall = {
          id: crypto.randomUUID(),
          color,
          agentId: agent.id,
          model: agent.model,
          moveNumber: state.fullmoveNumber,
          attempt,
          startedAt: new Date(startedAt).toISOString(),
          durationMs: 0,
          settings,
          historyCount: sharedLength,
          input: messagesForAgent.slice(sharedLength),
          cost: 0,
          outcome: 'error',
        };

        let result: GenerateResult;
        try {
          result = await agent.generate(messagesForAgent, opponent, state.fullmoveNumber);
        } catch (err) {
          if (!isStale()) {
            call.durationMs = Date.now() - startedAt;
            call.error = err instanceof Error ? err.message : String(err);
            session.calls.push(call);
            save();
          }
          throw err;
        }
        if (isStale()) return false;

        call.durationMs = Date.now() - startedAt;
        thinkingMs += call.durationMs;
        call.cost = result.cost;
        call.usage = result.meta.usage;
        call.providerMetadata = result.meta.providerMetadata;
        call.response = {
          text: result.text,
          reasoning: result.meta.reasoning,
          toolCalls: result.toolCalls,
          finishReason: result.meta.finishReason,
          id: result.meta.responseId,
          modelId: result.meta.responseModel,
        };
        if (result.cost) setTotalCost((prev) => prev + result.cost);

        // Record agent response in shared history
        const agentMessage: Message = {
          sender: 'agent',
          agentId: agent.id,
          agentName: agent.name,
          content: result.text,
          toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
        };

        // Send agent's text to the shared chat
        if (result.text) {
          chatRef.current?.addAgentMessage(agent.name, color, result.text);
          session.chat.push({ at: new Date().toISOString(), role: color, text: result.text, sender: agent.name });
        }

        messagesForAgent = [...messagesForAgent, agentMessage];

        // Process make-move tool call
        const moveCall = result.toolCalls.find((tc) => tc.tool === 'make-move');
        if (moveCall) {
          const moveSan = moveCall.args.move as string;
          const moveResult = engine.moveSAN(moveSan);
          call.move = moveSan;

          let toolResultContent: string;
          if (moveResult.success) {
            call.outcome = 'move';
            session.calls.push(call);
            session.moves.push({ ...describeLastMove(engine, 'agent'), callId: call.id, attempts: attempt, thinkingMs });
            syncResult(session, engine);
            setGameState(engine.getState());
            const history = engine.getHistory();
            const last = history[history.length - 1];
            if (last) setLastMove({ from: last.from, to: last.to });
            const updatedSan = engine.getSAN();
            setSanMoves(updatedSan);
            const lastSan = updatedSan[updatedSan.length - 1];
            playMoveSound(engine.getState(), lastSan);
            const moveNum = Math.ceil(updatedSan.length / 2);
            const side = updatedSan.length % 2 === 1 ? 'White' : 'Black';
            toolResultContent = `Move ${lastSan} accepted.`;
            say(`${moveNum}. ${side}: ${lastSan}`);
            moveSucceeded = true;
          } else {
            call.outcome = 'invalid-move';
            session.calls.push(call);
            playSound('illegal');
            toolResultContent = `Invalid move "${moveSan}": ${moveResult.error}`;
            say(`${agent.name} tried invalid move: ${moveSan} — ${moveResult.error}`);

            // Add FEN context on error if enabled and we have retries left
            if (sendFenOnError && attempt < maxAttempts) {
              const currentFen = engine.getFEN();
              toolResultContent += `\n\nCurrent position (FEN): ${currentFen}\nPlease try a valid move.`;
            }
          }

          const toolResultMessage: Message = {
            sender: 'system',
            agentId: agent.id,
            content: toolResultContent,
            toolResultFor: {
              callId: moveCall.id,
              toolName: moveCall.tool,
            },
          };

          messagesForAgent = [...messagesForAgent, toolResultMessage];
        } else {
          // Agent responded without making a move
          call.outcome = 'no-move';
          session.calls.push(call);
          say(`${agent.name} responded without making a move.`);

          // Add hint for retry
          if (attempt < maxAttempts) {
            const hintMsg: Message = {
              sender: 'system',
              agentId: agent.id,
              content: `You must call the make-move tool with your move. ${sendFenOnError ? `Current FEN: ${engine.getFEN()}` : ''}`,
            };
            messagesForAgent = [...messagesForAgent, hintMsg];
          }
        }
      }

      // Only add to shared messages when the move succeeded.
      // On success: add the context message and the final (successful)
      // attempt, dropping intermediate failed attempts so they don't leak to
      // the opponent. They go after whatever is in the shared history now, so
      // a moderator message sent while the model was thinking is kept.
      // On failure: leave sharedMessages unchanged — the next turn will
      // start fresh with its own context message.
      if (moveSucceeded) {
        commitMessages([
          ...sharedMessagesRef.current,
          ...messagesForAgent.slice(sharedLength, baseLength),
          ...messagesForAgent.slice(attemptStartIdx),
        ]);
      }
      return moveSucceeded;
    } catch (err) {
      if (isStale()) return false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      say(`${agent.name} error: ${errorMsg}`);
      return false;
    } finally {
      setThinkingColor(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  handleAgentMoveRef.current = handleAgentMove;

  const handleMoveWhite = useCallback(() => {
    return handleAgentMove('white');
  }, [handleAgentMove]);

  const handleMoveBlack = useCallback(() => {
    return handleAgentMove('black');
  }, [handleAgentMove]);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
    if (!autoPlay) return;
    let cancelled = false;
    (async () => {
      while (autoPlayRef.current && !cancelled) {
        // The game is over: asking the mated side for a move only costs a call.
        if (sessionRef.current.status === 'finished') {
          setAutoPlay(false);
          break;
        }
        const color = engineRef.current.getState().activeColor;
        const ok = await handleAgentMoveRef.current(color);
        if (!ok || !autoPlayRef.current || cancelled) {
          setAutoPlay(false);
          break;
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const handleModeratorMessage = useCallback((text: string) => {
    sessionRef.current.chat.push({ at: new Date().toISOString(), role: 'moderator', text });
    commitMessages([...sharedMessagesRef.current, { sender: 'moderator', content: text }]);
  }, [commitMessages]);

  const handleReset = useCallback((fisher?: boolean) => {
    onNewGame(!!fisher, playersRef.current);
  }, [onNewGame]);

  useEffect(() => {
    const el = notationRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [sanMoves]);

  // On open: bring a stored game back, or announce the new one.
  useEffect(() => {
    const session = sessionRef.current;
    if (initial.stored) {
      chatRef.current?.restore(session.chat);
      whiteRef.current?.restoreLog(logEntriesFor(session, 'white'));
      blackRef.current?.restoreLog(logEntriesFor(session, 'black'));
      const state = engineRef.current.getState();
      chatRef.current?.addSystemMessage(session.status === 'finished'
        ? 'Game restored — it is over.'
        : `Game restored — move ${state.fullmoveNumber}, ${state.activeColor} to move.`);
      return;
    }
    // Effects run twice in development; the announcement must be recorded once.
    if (announcedRef.current) {
      chatRef.current?.restore(session.chat);
      return;
    }
    announcedRef.current = true;
    const mode = session.mode === 'chess960' ? 'Chess960 (Fischer Random)' : 'Standard';
    say(`New game — Mode: ${mode} FEN: ${session.initialFen}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setWhiteOpen(!mobile);
      setBlackOpen(!mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const showWhite = whiteOpen;
  const showBlack = blackOpen;

  return (
    <>
      <Header totalCost={totalCost} gameId={started ? initial.session.id : undefined} />
      <div className="home">
        <div className="toolbar">
          <button
            type="button"
            className={`toolbar__toggle ${showWhite ? 'toolbar__toggle--active' : ''}`}
            onClick={() => setWhiteOpen((v) => !v)}
            aria-label={showWhite ? 'Hide white panel' : 'Show white panel'}
          >
            {showWhite ? '◀ White' : '▶ White'}
          </button>
          <div
            className="toolbar__notation"
            ref={notationRef}
            title={sanMoves.length > 0 ? 'Click to copy moves' : undefined}
            onClick={() => {
              if (sanMoves.length === 0) return;
              const text = sanMoves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(' ');
              navigator.clipboard.writeText(text);
              const el = notationRef.current;
              if (el) {
                el.classList.add('toolbar__notation--copied');
                setTimeout(() => el.classList.remove('toolbar__notation--copied'), 1000);
              }
            }}
          >
            {sanMoves.length === 0 && (
              <span className="toolbar__notation-empty">No moves yet</span>
            )}
            {sanMoves.map((move, i) => (
              <span key={i} className="toolbar__notation-move">
                {i % 2 === 0 && <span className="toolbar__notation-num">{Math.floor(i / 2) + 1}.</span>}
                {move}
              </span>
            ))}
          </div>
          <button
            type="button"
            className={`toolbar__toggle ${showBlack ? 'toolbar__toggle--active' : ''}`}
            onClick={() => setBlackOpen((v) => !v)}
            aria-label={showBlack ? 'Hide black panel' : 'Show black panel'}
          >
            {showBlack ? 'Black ▶' : 'Black ◀'}
          </button>
        </div>
        <div className="home__layout">
          <WhitePanel ref={whiteRef} isOpen={showWhite} messages={sharedMessages} fischer960={isFischer} restored={restoredPlayers?.white} defaults={defaults?.white} onSetupChange={handleSetupChange} />
          <Arena
            ref={chatRef}
            gameState={gameState}
            lastMove={lastMove}
            onMove={handleMove}
            onModeratorMessage={handleModeratorMessage}
            onReset={handleReset}
            onMoveWhite={handleMoveWhite}
            onMoveBlack={handleMoveBlack}
            thinkingColor={thinkingColor}
            activeColor={gameState.activeColor}
            gameOver={isCheckmate(gameState, gameState.activeColor) || isStalemate(gameState, gameState.activeColor)}
            autoPlay={autoPlay}
            onAutoPlayChange={setAutoPlay}
            fen={engineRef.current.getFEN()}
            sanMoves={sanMoves}
          />
          <BlackPanel ref={blackRef} isOpen={showBlack} messages={sharedMessages} fischer960={isFischer} restored={restoredPlayers?.black} defaults={defaults?.black} onSetupChange={handleSetupChange} />
        </div>
      </div>
    </>
  );
}
