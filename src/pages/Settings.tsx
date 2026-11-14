import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { ChessPrompts, ChessPromptsData, DEFAULT_PROMPTS } from '../agents/ChessPrompts';
import { exportSession, openSession, readSession, sessionFileName } from '../lib/session';
import type { SessionMeta } from '../lib/session';
import {
  deleteFinishedSessions,
  deleteSession,
  getSession,
  listSessions,
  putSession,
  subscribeSessions,
} from '../lib/sessionStore';
import { listHeldSessions } from '../lib/sessionLock';
import { gamePath } from '../lib/navigation';
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

/** Result in score notation, or "In progress" for a game still going. */
function outcome(game: SessionMeta): string {
  if (game.status !== 'finished') return 'In progress';
  if (game.winner === 'white') return '1-0';
  if (game.winner === 'black') return '0-1';
  return '½-½';
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

  const navigate = useNavigate();
  const [games, setGames] = useState<SessionMeta[] | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [heldGames, setHeldGames] = useState<string[]>([]);
  const [gamesNotice, setGamesNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const gamesRequest = useRef(0);

  const refreshGames = useCallback(async () => {
    const request = ++gamesRequest.current;
    try {
      // The list is still useful when the lock state cannot be read.
      const [list, held] = await Promise.all([
        listSessions(),
        listHeldSessions().catch(() => [] as string[]),
      ]);
      if (request !== gamesRequest.current) return;
      setGames(list);
      setHeldGames(held);
      setGamesError(null);
    } catch (err) {
      if (request !== gamesRequest.current) return;
      setGamesError(`Could not load the saved games: ${errorText(err)}`);
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void refreshGames(); };
    refresh();
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeSessions(refresh);
    } catch {
      // Without live updates the list is refreshed after each action only.
    }
    // Opening or closing a game in another tab changes what may be deleted,
    // and the store does not announce that.
    window.addEventListener('focus', refresh);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
    };
  }, [refreshGames]);

  const handleExportGame = async (id: string) => {
    try {
      const stored = await getSession(id);
      if (!stored) throw new Error('This game is no longer stored.');
      const { session, engine } = openSession(stored);
      const blob = new Blob([exportSession(session, engine)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sessionFileName(session);
      link.click();
      URL.revokeObjectURL(url);
      setGamesNotice({ kind: 'ok', text: `Exported ${link.download}` });
    } catch (err) {
      setGamesNotice({ kind: 'error', text: `Export failed: ${errorText(err)}` });
    }
  };

  const handleDeleteGame = async (game: SessionMeta) => {
    const title = `${game.white.name} vs ${game.black.name}`;
    if (!window.confirm(`Delete the game ${title}? This cannot be undone.`)) return;
    try {
      // The list may be stale: the game could have been opened in a tab since.
      const held = await listHeldSessions().catch(() => [] as string[]);
      if (held.includes(game.id)) {
        setHeldGames(held);
        throw new Error('the game is open in a tab. Close it there first.');
      }
      await deleteSession(game.id);
      setGamesNotice({ kind: 'ok', text: `Deleted ${title}.` });
    } catch (err) {
      setGamesNotice({ kind: 'error', text: `Delete failed: ${errorText(err)}` });
    }
    await refreshGames();
  };

  const handleImport = async (file: File) => {
    try {
      const { session } = readSession(await file.text());
      if (await getSession(session.id)
        && !window.confirm('This game is already in the list. Replace it?')) {
        return;
      }
      await putSession(session);
      navigate(gamePath(session.id));
    } catch (err) {
      setGamesNotice({ kind: 'error', text: `Import failed: ${errorText(err)}` });
    }
  };

  const handleDeleteFinished = async () => {
    if (!window.confirm('Delete all finished games? This cannot be undone.')) return;
    try {
      // Games open in a tab are kept, the same as with the per-game Delete.
      const held = await listHeldSessions().catch(() => [] as string[]);
      const removed = await deleteFinishedSessions(held);
      setGamesNotice({
        kind: 'ok',
        text: `Removed ${removed} finished ${removed === 1 ? 'game' : 'games'}.`,
      });
    } catch (err) {
      setGamesNotice({ kind: 'error', text: `Delete failed: ${errorText(err)}` });
    }
    await refreshGames();
  };

  const finishedCount = games?.filter((g) => g.status === 'finished').length ?? 0;

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
      // Validate the key itself rather than calling a model: model ids get
      // retired, and this endpoint costs nothing.
      const response = await fetch('https://openrouter.ai/api/v1/key', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
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
            <label className="settings-label">
              Games <span className="settings-hint">(stored in this browser)</span>
            </label>

            {gamesError && (
              <p className="settings-session-notice settings-session-notice--error">{gamesError}</p>
            )}
            {!gamesError && games === null && <p className="settings-games__empty">Loading…</p>}
            {!gamesError && games?.length === 0 && (
              <p className="settings-games__empty">
                No saved games yet. A game is saved once the first move is made.
              </p>
            )}
            {games && games.length > 0 && (
              <ul className="settings-games">
                {games.map((game) => {
                  const isHeld = heldGames.includes(game.id);
                  return (
                    <li key={game.id} className="settings-game">
                      <div className="settings-game__info">
                        <div className="settings-game__title">
                          <span className={`settings-game__status settings-game__status--${game.status}`}>
                            {outcome(game)}
                          </span>
                          <span className="settings-game__players">
                            {game.white.name} vs {game.black.name}
                          </span>
                          {game.mode === 'chess960' && (
                            <span className="settings-game__tag">Chess960</span>
                          )}
                          {isHeld && (
                            <span className="settings-game__tag settings-game__tag--held">open in a tab</span>
                          )}
                        </div>
                        <div className="settings-game__models">
                          {game.white.model} vs {game.black.model}
                        </div>
                        <div className="settings-game__details">
                          {Math.ceil(game.plies / 2)} {Math.ceil(game.plies / 2) === 1 ? 'move' : 'moves'}
                          {' · '}${game.cost.toFixed(4)}
                          {' · '}{shortDate(game.updatedAt)}
                        </div>
                      </div>
                      <div className="settings-game__actions">
                        <Link className="settings-button settings-game__action" to={gamePath(game.id)}>
                          Open
                        </Link>
                        <button
                          type="button"
                          className="settings-button settings-button--secondary settings-game__action"
                          onClick={() => handleExportGame(game.id)}
                        >
                          Export
                        </button>
                        <button
                          type="button"
                          className="settings-button settings-button--secondary settings-game__action settings-game__action--danger"
                          onClick={() => handleDeleteGame(game)}
                          disabled={isHeld}
                          title={isHeld ? 'This game is open in a tab. Close it there to delete it.' : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="settings-buttons settings-games__buttons">
              <button
                type="button"
                className="settings-button"
                onClick={() => importInputRef.current?.click()}
              >
                Import JSON
              </button>
              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={handleDeleteFinished}
                disabled={finishedCount === 0}
              >
                Delete finished
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset so the same file can be picked again.
                  e.target.value = '';
                  if (file) void handleImport(file);
                }}
              />
            </div>
            {gamesNotice && (
              <p className={`settings-session-notice settings-session-notice--${gamesNotice.kind}`}>
                {gamesNotice.text}
              </p>
            )}
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
