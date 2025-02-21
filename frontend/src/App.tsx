import Header from "./components/header/header";
import Board from "./components/board/Board";
import "./index.css";
import { Analytics } from '@vercel/analytics/react';

function App() {

  return (
    <>
      <Header githubLink="https://github.com/Cyrus-Krispin/gambitron" />
      <div className="board-container">
        <Board />
      </div>
      <Analytics />
    </>
  );
}

export default App;
