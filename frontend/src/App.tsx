import React from "react";
import Board from "./components/board/Board";
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Board />
      <Analytics />
    </div>
  );
};

export default App;
