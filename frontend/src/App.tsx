import React from "react";
import Board from "./components/board/Board";
import "./index.css";

const App: React.FC = () => {
  return (
    <div className="board-container">
      <Board />
    </div>
  );
};

export default App;
