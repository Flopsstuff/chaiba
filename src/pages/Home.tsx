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
import { MoveCommand } from '../types';
import type { ChessColor, Message } from '../types';
import './Home.css';

const MOBILE_BREAKPOINT = 768;

export function Home() {
  const engineRef = useRef<ChessEngine>(new ChessEngine());
  const chatRef = useRef<GameChatHandle>(null);
  const whiteRef = useRef<AgentCardHandle>(null);
  const blackRef = useRef<AgentCardHandle>(null);
  const [gameState, setGameState] = useState<GameState>(() => engineRef.current.getState());
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [sharedMessages, setSharedMessages] = useState<Message[]>([]);
  const sharedMessagesRef = useRef<Message[]>([]);
  const [thinkingColor, setThinkingColor] = useState<ChessColor | null>(null);
  const [whiteOpen, setWhiteOpen] = useState(false);
  const [blackOpen, setBlackOpen] = useState(false);
  const [isFischer, setIsFischer] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);
  const handleAgentMoveRef = useRef<(color: ChessColor) => Promise<boolean>>(null!);
  const notationRef = useRef<HTMLDivElement>(null);

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
      const moveNum = Math.ceil(san.length / 2);
      const side = san.length % 2 === 1 ? 'White' : 'Black';
      chatRef.current?.addSystemMessage(`${moveNum}. ${side}: ${lastSan}`);

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
      setSharedMessages((prev) => {
        const next = [...prev, agentMsg, toolResultMsg];
        sharedMessagesRef.current = next;
        return next;
      });
    } else {
      chatRef.current?.addSystemMessage(result.error);
    }
  }, []);

  const handleAgentMove = useCallback(async (color: ChessColor): Promise<boolean> => {
    const engine = engineRef.current;
    const state = engine.getState();

    if (state.activeColor !== color) {
      chatRef.current?.addSystemMessage(`It's not ${color}'s turn.`);
      return false;
    }

    const agentRef = color === 'white' ? whiteRef : blackRef;
    const agent = agentRef.current;
    if (!agent) {
      chatRef.current?.addSystemMessage(`${color} agent not ready.`);
      return false;
    }

    setThinkingColor(color);

    // Build context message with current FEN and move history (if enabled)
    const sendContext = localStorage.getItem('send_context_message') !== 'false';
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
      const result = await agent.generate(messagesForAgent, opponent, state.fullmoveNumber);
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
      }

      const newMessages = [...messagesForAgent, agentMessage];

      // Process make-move tool call
      const moveCall = result.toolCalls.find((tc) => tc.tool === 'make-move');
      if (moveCall) {
        const moveSan = moveCall.args.move as string;
        const moveResult = engine.moveSAN(moveSan);

        let toolResultContent: string;
        if (moveResult.success) {
          setGameState(engine.getState());
          const history = engine.getHistory();
          const last = history[history.length - 1];
          if (last) setLastMove({ from: last.from, to: last.to });
          const updatedSan = engine.getSAN();
          setSanMoves(updatedSan);
          const lastSan = updatedSan[updatedSan.length - 1];
          const moveNum = Math.ceil(updatedSan.length / 2);
          const side = updatedSan.length % 2 === 1 ? 'White' : 'Black';
          toolResultContent = `Move ${lastSan} accepted.`;
          chatRef.current?.addSystemMessage(`${moveNum}. ${side}: ${lastSan}`);
          moveSucceeded = true;
        } else {
          toolResultContent = `Invalid move "${moveSan}": ${moveResult.error}`;
          chatRef.current?.addSystemMessage(`${agent.name} tried invalid move: ${moveSan} — ${moveResult.error}`);
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

        newMessages.push(toolResultMessage);
      } else {
        // Agent responded without making a move
        chatRef.current?.addSystemMessage(`${agent.name} responded without making a move.`);
      }

      sharedMessagesRef.current = newMessages;
      setSharedMessages(newMessages);
      return moveSucceeded;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      chatRef.current?.addSystemMessage(`${agent.name} error: ${errorMsg}`);
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
    const msg: Message = { sender: 'moderator', content: text };
    setSharedMessages((prev) => {
      const next = [...prev, msg];
      sharedMessagesRef.current = next;
      return next;
    });
  }, []);

  const handleReset = useCallback((fisher?: boolean) => {
    engineRef.current.reset(fisher);
    const state = engineRef.current.getState();
    setGameState(state);
    const mode = fisher ? 'Chess960 (Fischer Random)' : 'Standard';
    const fen = engineRef.current.getFEN();
    setSanMoves([]);
    setLastMove(null);
    sharedMessagesRef.current = [];
    setSharedMessages([]);
    setIsFischer(!!fisher);
    setTotalCost(0);
    setAutoPlay(false);
    whiteRef.current?.rerollName();
    whiteRef.current?.clearLog();
    blackRef.current?.rerollName();
    blackRef.current?.clearLog();
    chatRef.current?.clear();
    chatRef.current?.addSystemMessage(`Game reset — Mode: ${mode} FEN: ${fen}`);
  }, []);

  useEffect(() => {
    const el = notationRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [sanMoves]);

  useEffect(() => {
    handleReset();
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
      <Header totalCost={totalCost} />
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
          <WhitePanel ref={whiteRef} isOpen={showWhite} messages={sharedMessages} fischer960={isFischer} />
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
          <BlackPanel ref={blackRef} isOpen={showBlack} messages={sharedMessages} fischer960={isFischer} />
        </div>
      </div>
    </>
  );
}
