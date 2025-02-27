import Board from "./components/board/Board";
import "./index.css";
import { Analytics } from '@vercel/analytics/react';

function App() {

  return (
    <>  
      <div className="board-container">
        <Board />
      </div>
      <Analytics />
    </>
  );
}

export default App;
