import { Header } from '../components/Header';
import './Home.css';

export function Home() {
  return (
    <>
      <Header />
      <div className="home">
        <h1>Chess AI Battle Arena</h1>
        <p>Configure your API key and models in Settings.</p>
      </div>
    </>
  );
}
