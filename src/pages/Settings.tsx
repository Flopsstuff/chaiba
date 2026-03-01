import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { ChessPrompts, ChessPromptsData, DEFAULT_PROMPTS } from '../agents/ChessPrompts';
import './Settings.css';

const API_KEY_STORAGE = 'openrouter_api_key';
const MODELS_STORAGE = 'selected_models';

interface ApiModel {
  id: string;
  name: string;
  promptPrice?: number;
  completionPrice?: number;
  supportsTools?: boolean;
}

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const [allModels, setAllModels] = useState<ApiModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<ApiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [search, setSearch] = useState('');

  const [prompts, setPrompts] = useState<ChessPromptsData>(DEFAULT_PROMPTS);
  const [promptsSaved, setPromptsSaved] = useState(false);
  const [sendContext, setSendContext] = useState(true);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [sendFenOnError, setSendFenOnError] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE);
    if (storedKey) {
      setApiKey(storedKey);
    }

    const storedModels = localStorage.getItem(MODELS_STORAGE);
    if (storedModels) {
      setSelectedModels(JSON.parse(storedModels));
    }

    setPrompts(ChessPrompts.loadPrompts());

    const storedContext = localStorage.getItem('send_context_message');
    setSendContext(storedContext !== 'false');

    const storedRetry = localStorage.getItem('retry_attempts');
    setRetryAttempts(storedRetry ? parseInt(storedRetry, 10) : 0);

    const storedFenOnError = localStorage.getItem('send_fen_on_error');
    setSendFenOnError(storedFenOnError === 'true');
  }, []);

  const handleSavePrompts = () => {
    ChessPrompts.savePrompts(prompts);
    setPromptsSaved(true);
    setTimeout(() => setPromptsSaved(false), 2000);
  };

  const handleResetPrompts = () => {
    setPrompts(DEFAULT_PROMPTS);
    ChessPrompts.savePrompts(DEFAULT_PROMPTS);
    setPromptsSaved(true);
    setTimeout(() => setPromptsSaved(false), 2000);
  };

  const handleSave = () => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!apiKey) {
      setTestResult('error');
      setTimeout(() => setTestResult(null), 2000);
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 2000);
    }
  };

  const handleLoadModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (response.ok) {
        const data = await response.json();
        const models = data.data.map((m: { id: string; name: string; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[] }) => ({
          id: m.id,
          name: m.name,
          promptPrice: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : undefined,
          completionPrice: m.pricing?.completion ? parseFloat(m.pricing.completion) : undefined,
          supportsTools: m.supported_parameters?.includes('tools') ?? false,
        }));
        setAllModels(models);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const toggleModel = (model: ApiModel) => {
    const exists = selectedModels.find((m) => m.id === model.id);
    let newSelected: ApiModel[];
    if (exists) {
      newSelected = selectedModels.filter((m) => m.id !== model.id);
    } else {
      newSelected = [...selectedModels, { id: model.id, name: model.name }];
    }
    setSelectedModels(newSelected);
    localStorage.setItem(MODELS_STORAGE, JSON.stringify(newSelected));
  };

  const formatPrice = (pricePerToken: number | undefined) => {
    if (pricePerToken === undefined) return null;
    if (pricePerToken === 0) return 'Free';
    const perMillion = pricePerToken * 1_000_000;
    if (perMillion < 0.01) return '<$0.01/M';
    return `$${perMillion % 1 === 0 ? perMillion.toFixed(0) : perMillion.toFixed(2)}/M`;
  };

  const filteredModels = allModels
    .filter(
      (m) =>
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <Header showBack />
      <div className="settings">
        <div className="settings-content">
          <h1>Settings</h1>

          <div className="settings-section">
            <label className="settings-label" htmlFor="api-key">
              OpenRouter API Key <span className="settings-hint">(stored locally in browser)</span>
            </label>
            <input
              id="api-key"
              type="text"
              className="settings-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
            />
            <div className="settings-buttons">
              <button className="settings-button" onClick={handleSave}>
                {saved ? 'Saved!' : 'Save'}
              </button>
              <button
                className={`settings-button settings-button-test ${testResult === 'success' ? 'success' : ''} ${testResult === 'error' ? 'error' : ''}`}
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? 'Testing...' : testResult === 'success' ? 'OK!' : testResult === 'error' ? 'Failed' : 'Test'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label">
              Models <span className="settings-hint">({selectedModels.length} selected)</span>
            </label>

            {selectedModels.length > 0 && (
              <div className="selected-models">
                {selectedModels.map((m) => (
                  <span key={m.id} className="selected-model-tag">
                    {m.id}
                    <button onClick={() => toggleModel(m)}>×</button>
                  </span>
                ))}
              </div>
            )}

            <button
              className="settings-button"
              onClick={handleLoadModels}
              disabled={loadingModels}
            >
              {loadingModels ? 'Loading...' : allModels.length > 0 ? 'Refresh Models' : 'Load Models'}
            </button>

            {allModels.length > 0 && (
              <>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Search models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="models-list">
                  {filteredModels.map((model) => (
                    <label key={model.id} className="model-item">
                      <input
                        type="checkbox"
                        checked={selectedModels.some((m) => m.id === model.id)}
                        onChange={() => toggleModel(model)}
                      />
                      <span className="model-id">{model.id}</span>
                      {model.supportsTools && (
                        <span className="model-badge model-badge--tools">tools</span>
                      )}
                      {formatPrice(model.promptPrice) && (
                        <span className="model-price">{formatPrice(model.promptPrice)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="settings-section">
            <label className="settings-label">
              Prompts <span className="settings-hint">(stored locally in browser)</span>
            </label>

            <label className="settings-label settings-label--small" htmlFor="prompt-base">
              Base prompt
            </label>
            <textarea
              id="prompt-base"
              className="settings-textarea"
              value={prompts.base}
              onChange={(e) => setPrompts({ ...prompts, base: e.target.value })}
              rows={4}
            />

            <label className="settings-label settings-label--small" htmlFor="prompt-white">
              White prompt
            </label>
            <textarea
              id="prompt-white"
              className="settings-textarea"
              value={prompts.white}
              onChange={(e) => setPrompts({ ...prompts, white: e.target.value })}
              rows={2}
            />

            <label className="settings-label settings-label--small" htmlFor="prompt-black">
              Black prompt
            </label>
            <textarea
              id="prompt-black"
              className="settings-textarea"
              value={prompts.black}
              onChange={(e) => setPrompts({ ...prompts, black: e.target.value })}
              rows={2}
            />

            <div className="settings-buttons">
              <button className="settings-button" onClick={handleSavePrompts}>
                {promptsSaved ? 'Saved!' : 'Save Prompts'}
              </button>
              <button className="settings-button settings-button--secondary" onClick={handleResetPrompts}>
                Reset to Defaults
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label">Game</label>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={sendContext}
                onChange={(e) => {
                  setSendContext(e.target.checked);
                  localStorage.setItem('send_context_message', String(e.target.checked));
                }}
              />
              Send board context (FEN + move history) before each move
            </label>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={sendFenOnError}
                onChange={(e) => {
                  setSendFenOnError(e.target.checked);
                  localStorage.setItem('send_fen_on_error', String(e.target.checked));
                }}
              />
              Send FEN from Moderator when agent makes invalid move
            </label>
            <div className="settings-retry">
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={retryAttempts > 0}
                  onChange={(e) => {
                    const value = e.target.checked ? 3 : 0;
                    setRetryAttempts(value);
                    localStorage.setItem('retry_attempts', String(value));
                  }}
                />
                Retry on invalid move
              </label>
              {retryAttempts > 0 && (
                <input
                  type="number"
                  className="settings-retry__input"
                  min={1}
                  max={10}
                  value={retryAttempts}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                    setRetryAttempts(value);
                    localStorage.setItem('retry_attempts', String(value));
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
