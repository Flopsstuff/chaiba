import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { WhitePanel } from '../components/panels/WhitePanel';
import { Arena } from '../components/panels/Arena';
import { BlackPanel } from '../components/panels/BlackPanel';
import { ChessEngine } from '../chess/engine';
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
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [sharedMessages, setSharedMessages] = useState<Message[]>([]);
  const [thinkingColor, setThinkingColor] = useState<ChessColor | null>(null);
  const [whiteOpen, setWhiteOpen] = useState(false);
  const [blackOpen, setBlackOpen] = useState(false);
  const notationRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((from: number, to: number) => {
    const engine = engineRef.current;
    const fileChar = (i: number) => String.fromCharCode(97 + (i % 8));
    const rankChar = (i: number) => String(Math.floor(i / 8) + 1);
    const uci = fileChar(from) + rankChar(from) + fileChar(to) + rankChar(to);

    const result = engine.moveUCI(uci);
    if (result.success) {
      setGameState(engine.getState());
      const san = engine.getSAN();
      setSanMoves(san);
      const lastMove = san[san.length - 1];
      const moveNum = Math.ceil(san.length / 2);
      const side = san.length % 2 === 1 ? 'White' : 'Black';
      chatRef.current?.addSystemMessage(`${moveNum}. ${side}: ${lastMove}`);
    } else {
      chatRef.current?.addSystemMessage(result.error);
    }
  }, []);

  const handleAgentMove = useCallback(async (color: ChessColor) => {
    const engine = engineRef.current;
    const state = engine.getState();

    if (state.activeColor !== color) {
      chatRef.current?.addSystemMessage(`It's not ${color}'s turn.`);
      return;
    }

    const agentRef = color === 'white' ? whiteRef : blackRef;
    const agent = agentRef.current;
    if (!agent) {
      chatRef.current?.addSystemMessage(`${color} agent not ready.`);
      return;
    }

    setThinkingColor(color);

    // Build context message with current FEN and move history (if enabled)
    const sendContext = localStorage.getItem('send_context_message') !== 'false';
    let messagesForAgent = [...sharedMessages];

    if (sendContext) {
      const fen = engine.getFEN();
      const san = engine.getSAN();
      const moveHistory = san.length > 0 ? `Moves so far: ${san.join(' ')}` : 'No moves yet.';
      const contextMsg: Message = {
        sender: 'system',
        agentId: agent.id,
        content: `Current position (FEN): ${fen}\n${moveHistory}\nIt is ${color}'s turn. ${MoveCommand}.`,
      };
      messagesForAgent = [...messagesForAgent, contextMsg];
    } else {
      const contextMsg: Message = {
        sender: 'system',
        agentId: agent.id,
        content: `It is ${color}'s turn. ${MoveCommand}.`,
      };
      messagesForAgent = [...messagesForAgent, contextMsg];
    }

    const opponentRef = color === 'white' ? blackRef : whiteRef;
    const opponent = opponentRef.current
      ? { name: opponentRef.current.name, color: opponentRef.current.color }
      : undefined;

    try {
      const result = await agent.generate(messagesForAgent, opponent);

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
          const updatedSan = engine.getSAN();
          setSanMoves(updatedSan);
          const lastMove = updatedSan[updatedSan.length - 1];
          const moveNum = Math.ceil(updatedSan.length / 2);
          const side = updatedSan.length % 2 === 1 ? 'White' : 'Black';
          toolResultContent = `Move ${lastMove} accepted.`;
          chatRef.current?.addSystemMessage(`${moveNum}. ${side}: ${lastMove}`);
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

      setSharedMessages(newMessages);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      chatRef.current?.addSystemMessage(`${agent.name} error: ${errorMsg}`);
    } finally {
      setThinkingColor(null);
    }
  }, [sharedMessages]);

  const handleMoveWhite = useCallback(() => {
    handleAgentMove('white');
  }, [handleAgentMove]);

  const handleMoveBlack = useCallback(() => {
    handleAgentMove('black');
  }, [handleAgentMove]);

  const handleModeratorMessage = useCallback((text: string) => {
    const msg: Message = { sender: 'moderator', content: text };
    setSharedMessages((prev) => [...prev, msg]);
  }, []);

  const handleReset = useCallback((fisher?: boolean) => {
    engineRef.current.reset(fisher);
    const state = engineRef.current.getState();
    setGameState(state);
    const mode = fisher ? 'Chess960 (Fischer Random)' : 'Standard';
    const fen = engineRef.current.getFEN();
    setSanMoves([]);
    setSharedMessages([]);
    whiteRef.current?.rerollName();
    blackRef.current?.rerollName();
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
      <Header
        onReset={handleReset}
        onMoveWhite={handleMoveWhite}
        onMoveBlack={handleMoveBlack}
        thinkingColor={thinkingColor}
      />
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
          <div className="toolbar__notation" ref={notationRef}>
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
          <WhitePanel ref={whiteRef} isOpen={showWhite} messages={sharedMessages} />
          <Arena ref={chatRef} gameState={gameState} onMove={handleMove} onModeratorMessage={handleModeratorMessage} />
          <BlackPanel ref={blackRef} isOpen={showBlack} messages={sharedMessages} />
        </div>
      </div>
    </>
  );
}
