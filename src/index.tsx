import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Local development only: take the OpenRouter key from .env.development.local
// when the browser has none, so a fresh dev origin works without retyping it.
// The DEV guard keeps the key out of production builds.
if (import.meta.env.DEV) {
  const devKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (devKey && !localStorage.getItem('openrouter_api_key')) {
    localStorage.setItem('openrouter_api_key', devKey);
  }
}

// The single-game localStorage save of an earlier version; games live in IndexedDB now.
localStorage.removeItem('game_session');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
