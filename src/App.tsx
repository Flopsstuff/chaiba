import { HashRouter, Routes, Route } from 'react-router-dom';
import { Game } from './pages/Game';
import { Settings } from './pages/Settings';
import './App.css';

function App() {
  return (
    <HashRouter>
      <div className="App">
        <Routes>
          <Route path="/settings" element={<Settings />} />
          {/* One route for `/` and `/game/:id`, so the board is not remounted
              when a new game gets its id and the address changes under it. */}
          <Route path="/*" element={<Game />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
