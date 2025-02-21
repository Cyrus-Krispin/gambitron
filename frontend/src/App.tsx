import Header from "./components/header/header";
import Board from "./components/board/Board";
import "./index.css";

function App() {

  return (
    <>
      <Header githubLink="https://github.com/Cyrus-Krispin/gambitron" />
      <div className="board-container">
        <Board />
      </div>
    </>
  );
}

export default App;
