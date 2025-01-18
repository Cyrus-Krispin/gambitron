import { useState } from "react";
import Header from "./components/header/header";
import StartButton from "./components/start/start";
import Board from "./components/board/Board";
import "./index.css";

function App() {
  const [gameStarted, setGameStarted] = useState(false);

  const startGame = () => {
    setGameStarted(true);
  };

  return (
    <>
      <Header githubLink="https://github.com/Cyrus-Krispin/chess_bot" />
      {!gameStarted && <StartButton onStart={startGame} />}
      {gameStarted ? (
        <div className="board-container">
          <Board />
        </div>
      ) : (
        <p className="start-game-message">Click "Start Game" to play!</p>
      )}
    </>
  );
}

export default App;
