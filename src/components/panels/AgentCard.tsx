import { useState, useMemo, useCallback } from 'react';
import { useChessPlayer } from '../../hooks/useChessPlayer';
import { ChessPrompts } from '../../agents/ChessPrompts';
import { getSelectedModel } from '../../lib/models';
import { MessageBubble } from './MessageBubble';
import { ChessColor } from '../../types';
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

interface AgentCardProps {
  color: ChessColor;
}

export function AgentCard({ color }: AgentCardProps) {
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

  const { messages, status, error } = useChessPlayer(config);

  const rerollName = useCallback(() => {
    setAgentName(randomName());
  }, []);

  const playerLabel = color === 'white' ? 'White' : 'Black';

  return (
    <div className="agent-card">
      <div className="agent-card__header">
        <div className="agent-card__name-row">
          <span className="agent-card__name">{agentName}</span>
          <button
            className="agent-card__reroll"
            onClick={rerollName}
            title="Random name"
          >
            &#x21bb;
          </button>
          {status === 'thinking' && <span className="agent-card__status agent-card__status--thinking">...</span>}
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

      <div className="agent-card__messages">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} playerLabel={playerLabel} />
        ))}
      </div>
    </div>
  );
}
