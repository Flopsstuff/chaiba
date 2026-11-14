import { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useChessPlayer } from '../../hooks/useChessPlayer';
import { ChessPrompts } from '../../agents/ChessPrompts';
import { getSelectedModel } from '../../lib/models';
import { MessageBubble } from './MessageBubble';
import { ColorSpinner } from '../ColorSpinner';
import { ChessColor, Message, PlayerStatus, GenerateResult, LogRestoreEntry, Opponent } from '../../types';
import type { SessionPlayer } from '../../lib/session';
import './AgentCard.css';

const AGENT_NAMES = [
  'Kasparov', 'Fischer', 'Capablanca', 'Tal', 'Morphy',
  'Carlsen', 'Botvinnik', 'Petrosian', 'Karpov', 'Anand',
  'Alekhine', 'Spassky', 'Kramnik', 'Topalov', 'Smyslov',
  'Euwe', 'Steinitz', 'Lasker', 'Nimzowitsch', 'Reshevsky',
];

function randomName(): string {
  return AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
}

function getAvailableModels(): { id: string; name?: string }[] {
  const stored = localStorage.getItem('selected_models');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch { /* ignore */ }
  }
  return [{ id: 'openai/gpt-4o', name: 'GPT-4o' }];
}

export interface AgentCardHandle {
  generate: (messages: Message[], opponent?: Opponent, moveNumber?: number) => Promise<GenerateResult>;
  rerollName: () => void;
  clearLog: () => void;
  restoreLog: (entries: LogRestoreEntry[]) => void;
  model: string;
  id: string;
  name: string;
  color: ChessColor;
  status: PlayerStatus;
}

interface AgentCardProps {
  color: ChessColor;
  messages: Message[];
  fischer960?: boolean;
  /**
   * The player of a restored game. Sets the initial name, model and custom
   * instructions, and pins the agent id and base prompt to the saved ones for
   * as long as it is passed.
   */
  restored?: SessionPlayer | null;
  /** For a new game: the model and custom instructions to start from. */
  defaults?: Pick<SessionPlayer, 'model' | 'modelName' | 'customPrompt'>;
  /** Called whenever the player's setup changes (and once on mount). */
  onSetupChange?: (color: ChessColor, setup: SessionPlayer) => void;
}

export const AgentCard = forwardRef<AgentCardHandle, AgentCardProps>(
  function AgentCard({ color, messages, fischer960, restored, defaults, onSetupChange }, ref) {
    const modelIndex = color === 'white' ? 0 : 1;

    const [agentName, setAgentName] = useState(() => restored?.name ?? randomName());
    const [selectedModel, setSelectedModel] = useState(() => restored?.model ?? defaults?.model ?? getSelectedModel(modelIndex));
    const [customPrompt, setCustomPrompt] = useState(() => restored?.customPrompt ?? defaults?.customPrompt ?? '');
    const [restoredId] = useState(() => restored?.id);

    // A restored game keeps the prompt it was started with, even if the
    // prompts in Settings have changed since.
    const currentBasePrompt = useMemo(() => ChessPrompts.getBasePrompt(color), [color]);
    const basePrompt = restored?.basePrompt ?? currentBasePrompt;
    const availableModels = useMemo(() => {
      const models = getAvailableModels();
      // The model of an imported game may not be among the ones selected here.
      const known = restored ?? defaults;
      if (known?.model && !models.some((m) => m.id === known.model)) {
        models.push({ id: known.model, name: known.modelName });
      }
      return models;
    }, [restored, defaults]);

    const systemPrompt = useMemo(() => {
      return customPrompt ? `${basePrompt}\n\n${customPrompt}` : basePrompt;
    }, [basePrompt, customPrompt]);

    const config = useMemo(() => ({
      id: restoredId,
      name: agentName,
      color,
      model: selectedModel,
      systemPrompt,
      fischer960,
    }), [restoredId, agentName, color, selectedModel, systemPrompt, fischer960]);

    const { id, name, status, error, messageLog, generate, clearLog, restoreLog } = useChessPlayer(config);

    useEffect(() => {
      onSetupChange?.(color, {
        id,
        name: agentName,
        model: selectedModel,
        modelName: availableModels.find((m) => m.id === selectedModel)?.name,
        basePrompt,
        customPrompt,
      });
    }, [onSetupChange, color, id, agentName, selectedModel, availableModels, basePrompt, customPrompt]);
    const [showLog, setShowLog] = useState(false);
    const gameStarted = messages.length > 0;

    const rerollName = useCallback(() => {
      setAgentName(randomName());
    }, []);

    useImperativeHandle(ref, () => ({
      generate,
      rerollName,
      clearLog,
      restoreLog,
      model: selectedModel,
      id,
      name,
      color,
      status,
    }), [generate, rerollName, clearLog, restoreLog, selectedModel, id, name, color, status]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const getCallCost = useCallback((entry: { messages: unknown[] }): number | null => {
      const last = entry.messages[entry.messages.length - 1] as Record<string, unknown> | undefined;
      if (!last) return null;
      const usage = last.usage as Record<string, unknown> | undefined;
      const raw = usage?.raw as Record<string, unknown> | undefined;
      const cost = raw?.cost;
      return typeof cost === 'number' ? cost : null;
    }, []);

    const totalCost = useMemo(() => {
      let sum = 0;
      for (const entry of messageLog) {
        const c = getCallCost(entry);
        if (c !== null) sum += c;
      }
      return sum;
    }, [messageLog, getCallCost]);

    // Filter messages for display
    const displayMessages = useMemo(() => {
      return messages.filter((m) => {
        // Skip system context messages meant for the opponent
        if (m.sender === 'system' && m.agentId && m.agentId !== id) return false;
        // Skip opponent's tool results (shown as move in their bubble already)
        if (m.toolResultFor && m.agentId !== id) return false;
        if (m.sender === 'system' || m.sender === 'moderator') return true;
        if (m.sender === 'agent') return true;
        return false;
      });
    }, [messages, id]);

    useEffect(() => {
      const el = messagesEndRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, [displayMessages]);

    return (
      <div className="agent-card">
        <div className="agent-card__header">
          <div className="agent-card__name-row">
            <ColorSpinner color={color} spinning={status === 'thinking'} />
            <span className="agent-card__name">{agentName}</span>
            {!gameStarted && (
              <button
                className="agent-card__reroll"
                onClick={rerollName}
                title="Random name"
              >
                &#x21bb;
              </button>
            )}
            {status === 'error' && <span className="agent-card__status agent-card__status--error">!</span>}
            <button
              className="agent-card__info"
              onClick={() => setShowLog(true)}
              title="Message log"
            >
              &#x24D8;
            </button>
          </div>
        </div>

        {error && <div className="agent-card__error">{error}</div>}

        <div className="agent-card__config">
          <label className="agent-card__label">
            Model
            <select
              className="agent-card__select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={gameStarted}
            >
              {availableModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </label>
          <label className="agent-card__label">
            System prompt
            <textarea
              className="agent-card__textarea agent-card__textarea--readonly"
              value={basePrompt}
              readOnly
              rows={4}
            />
          </label>
          <label className="agent-card__label">
            Custom instructions
            <textarea
              className="agent-card__textarea"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              disabled={gameStarted}
              rows={3}
              placeholder="Additional instructions for this agent..."
            />
          </label>
        </div>

        <div className="agent-card__messages" ref={messagesEndRef}>
          {displayMessages.map((msg, i) => (
            <MessageBubble key={i} message={msg} currentAgentId={id} />
          ))}
          {status === 'thinking' && (
            <div className="agent-card__loader">
              <span className="agent-card__loader-dot" />
              <span className="agent-card__loader-dot" />
              <span className="agent-card__loader-dot" />
            </div>
          )}
        </div>

        {showLog && (
          <div className="agent-log-overlay" onClick={() => setShowLog(false)}>
            <div className="agent-log" onClick={(e) => e.stopPropagation()}>
              <div className="agent-log__header">
                <span className="agent-log__title">Message Log: {agentName} ({color}) — {messageLog.length} calls{totalCost > 0 ? ` · $${totalCost.toFixed(4)}` : ''}</span>
                <button className="agent-log__close" onClick={() => setShowLog(false)}>&times;</button>
              </div>
              <div className="agent-log__content">
                {messageLog.length === 0 && (
                  <div className="agent-log__empty">No messages yet.</div>
                )}
                {messageLog.map((entry, ci) => (
                  <div key={ci} className="agent-log__call-wrap">
                    <button
                      className="agent-log__copy"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(JSON.stringify(entry.messages, null, 2));
                        const el = e.currentTarget;
                        el.textContent = 'Copied';
                        setTimeout(() => { el.textContent = 'Copy'; }, 1500);
                      }}
                    >
                      Copy
                    </button>
                    <details className="agent-log__call">
                    <summary className="agent-log__call-summary">
                      Call #{ci + 1} — {new Date(entry.timestamp).toLocaleTimeString()}
                      <span className="agent-log__call-count">{entry.messages.length} msgs</span>
                      {(() => { const c = getCallCost(entry); return c !== null ? <span className="agent-log__call-cost">${c.toFixed(4)}</span> : null; })()}
                    </summary>
                    <div className="agent-log__call-messages">
                      {entry.messages.map((msg, mi) => {
                        const m = msg as Record<string, unknown>;
                        const role = String(m.role || 'unknown');
                        const extractText = (v: unknown): string => {
                          if (typeof v === 'string') return v;
                          if (Array.isArray(v)) return v.map(item => {
                            const it = item as Record<string, unknown>;
                            return it.text || it.value || '';
                          }).filter(Boolean).join(' ');
                          return '';
                        };
                        const raw = extractText(m.content) || extractText(m.text);
                        const preview = role === 'assistant' && m.toolCalls
                          ? `tool: ${JSON.stringify(m.toolCalls)}`
                          : raw.slice(0, 100);
                        return (
                          <details key={mi} className="agent-log__msg">
                            <summary className="agent-log__msg-summary">
                              <span className={`agent-log__role agent-log__role--${role}`}>{role}</span>
                              <span className="agent-log__preview">{preview}</span>
                            </summary>
                            <pre className="agent-log__msg-body">
                              {JSON.stringify(msg, null, 2)}
                            </pre>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
