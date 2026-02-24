import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import './App.css';

function App() {
  return (
    <HashRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
