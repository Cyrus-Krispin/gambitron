import React from "react";
import Board from "./components/board/Board";
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="grid grid-cols-[300px_1fr_300px] min-h-screen">
        <Board />
      </div>
      <Analytics />
    </div>
  );
};

export default App;
