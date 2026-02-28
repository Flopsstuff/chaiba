import { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useChessPlayer } from '../../hooks/useChessPlayer';
import { ChessPrompts } from '../../agents/ChessPrompts';
import { getSelectedModel } from '../../lib/models';
import { MessageBubble } from './MessageBubble';
import { ColorSpinner } from '../ColorSpinner';
import { ChessColor, Message, PlayerStatus, ToolCallData } from '../../types';
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
  generate: (messages: Message[]) => Promise<{ text: string; toolCalls: ToolCallData[] }>;
  id: string;
  name: string;
  status: PlayerStatus;
}

interface AgentCardProps {
  color: ChessColor;
  messages: Message[];
}

export const AgentCard = forwardRef<AgentCardHandle, AgentCardProps>(
  function AgentCard({ color, messages }, ref) {
    const modelIndex = color === 'white' ? 0 : 1;

    const [agentName, setAgentName] = useState(randomName);
    const [selectedModel, setSelectedModel] = useState(() => getSelectedModel(modelIndex));
    const [customPrompt, setCustomPrompt] = useState('');

    const basePrompt = useMemo(() => ChessPrompts.getBasePrompt(color), [color]);
    const availableModels = useMemo(getAvailableModels, []);

    const systemPrompt = useMemo(() => {
      return customPrompt ? `${basePrompt}\n\n${customPrompt}` : basePrompt;
    }, [basePrompt, customPrompt]);

    const config = useMemo(() => ({
      name: agentName,
      color,
      model: selectedModel,
      systemPrompt,
    }), [agentName, color, selectedModel, systemPrompt]);

    const { id, name, status, error, generate } = useChessPlayer(config);

    useImperativeHandle(ref, () => ({
      generate,
      id,
      name,
      status,
    }), [generate, id, name, status]);

    const rerollName = useCallback(() => {
      setAgentName(randomName());
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Filter messages for display: system, moderator, own agent, opponent agent
    const displayMessages = useMemo(() => {
      return messages.filter((m) => {
        if (m.sender === 'system' || m.sender === 'moderator') return true;
        if (m.sender === 'agent') return true;
        return false;
      });
    }, [messages]);

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
            <button
              className="agent-card__reroll"
              onClick={rerollName}
              title="Random name"
            >
              &#x21bb;
            </button>
            {status === 'error' && <span className="agent-card__status agent-card__status--error">!</span>}
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
      </div>
    );
  }
);
